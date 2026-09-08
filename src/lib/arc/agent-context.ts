// Agent context store. SERVER ONLY.
//
// ARC pulls from upstream systems and parks a normalised snapshot here; bots read
// the merged bundle. The bots never learn MCP, never hold a Meta token, and never
// change when a source is added — a new source is a new namespace.
//
// Writers: any cron or worker with ARC_INGEST_SECRET (see /api/agent/context POST).
// Readers: /api/agent/context GET.

import { supabaseAdmin } from "@/lib/supabase"

/** Namespaces ARC knows how to describe. Unknown ones still store and serve fine. */
export const KNOWN_NAMESPACES = [
  "meta_ads",
  "briefs",
  "signals",
  "pipeline",
  "metrics",
  "icp_keywords",
  "market",
  "gtm",
] as const

export type ContextBlock = {
  namespace: string
  /** Brand slug, or "global" for account-wide data. */
  scope: string
  payload: Record<string, unknown>
  summary_md: string
  source: string
  fetched_at: string
  /** ISO timestamp, or null when the data never goes stale. */
  expires_at: string | null
}

export type ContextRow = ContextBlock & { stale: boolean; age_seconds: number }

/** Minutes-to-ISO helper so callers express TTL in the unit they actually think in. */
export function ttl(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

/**
 * Upsert one snapshot. Keyed on (namespace, scope), so a re-pull replaces rather
 * than accumulates — bots always see exactly one live row per source.
 */
export async function writeContext(
  block: Omit<ContextBlock, "fetched_at" | "expires_at"> &
    Partial<Pick<ContextBlock, "fetched_at" | "expires_at">>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString()
  const row = {
    namespace: block.namespace,
    scope: block.scope || "global",
    payload: block.payload ?? {},
    summary_md: block.summary_md ?? "",
    source: block.source || "unknown",
    fetched_at: block.fetched_at ?? now,
    expires_at: block.expires_at ?? null,
    updated_at: now,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from("agent_context")
    .upsert(row, { onConflict: "namespace,scope" })

  return error ? { ok: false, error: error.message } : { ok: true }
}

/**
 * Read the bundle a bot should see.
 *
 * Stale rows are returned, not dropped. A bot that knows the ad spend is six
 * hours old can say so; a bot handed a silently missing namespace invents an
 * answer instead. `stale` is the flag to branch on.
 */
export async function readContext(opts: {
  namespaces?: string[]
  /** Brand slug. Global rows are always included — brand data layers on top. */
  scope?: string
} = {}): Promise<{ blocks: ContextRow[] } | { error: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabaseAdmin as any)
    .from("agent_context")
    .select("namespace, scope, payload, summary_md, source, fetched_at, expires_at")
    .order("namespace", { ascending: true })

  if (opts.namespaces?.length) q = q.in("namespace", opts.namespaces)
  // `global` rides along with every brand query: account-wide facts (ad spend,
  // signals) are context for a brand conversation too, not a separate fetch.
  if (opts.scope && opts.scope !== "global") q = q.in("scope", [opts.scope, "global"])

  const { data, error } = await q
  if (error) return { error: error.message }

  const now = Date.now()
  const blocks: ContextRow[] = (data || []).map((r: ContextBlock) => {
    const fetched = new Date(r.fetched_at).getTime()
    return {
      ...r,
      age_seconds: Math.max(0, Math.round((now - fetched) / 1000)),
      stale: r.expires_at ? new Date(r.expires_at).getTime() < now : false,
    }
  })

  return { blocks }
}

/**
 * Flatten the bundle into one markdown block for a system prompt.
 *
 * Bots that just want "everything ARC knows" call the endpoint with ?format=md
 * and paste this in. Staleness is stated inline rather than filtered out, for the
 * same reason readContext keeps stale rows.
 */
export function bundleToMarkdown(blocks: ContextRow[]): string {
  if (!blocks.length) return ""

  const parts = blocks
    .filter((b) => b.summary_md.trim())
    .map((b) => {
      const age =
        b.age_seconds < 3600
          ? `${Math.round(b.age_seconds / 60)}m old`
          : `${Math.round(b.age_seconds / 3600)}h old`
      const flag = b.stale ? " — STALE, treat as historical" : ""
      return `## ${b.namespace}${b.scope !== "global" ? ` (${b.scope})` : ""}\n_${age}${flag}_\n\n${b.summary_md.trim()}`
    })

  return parts.join("\n\n")
}
