// The bot-facing context endpoint. Bots pull everything ARC knows from here.
//
// GET  /api/agent/context?ns=meta_ads,briefs&scope=windchasers&format=md
// POST /api/agent/context   { namespace, scope?, payload?, summary_md?, source?, ttl_minutes? }
//
// Auth: Authorization: Bearer $ARC_INGEST_SECRET on both verbs. Fail-closed — with
// no secret set, nothing reads and nothing writes. Reads are gated too (unlike
// /api/proxe/briefs) because this bundle is meant to be pasted into a model prompt
// and will carry commercial numbers, not a public dashboard's worth of data.
//
// Lives under /api/agent/* so the session-cookie middleware already exempts it.
import { checkIngestAuth, authError } from "@/lib/ingest-auth"
import { readContext, writeContext, bundleToMarkdown, ttl } from "@/lib/arc/agent-context"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: Request) {
  const auth = checkIngestAuth(req)
  if (!auth.ok) return authError(auth)

  const url = new URL(req.url)
  const ns = url.searchParams.get("ns")
  const scope = url.searchParams.get("scope") || undefined
  const format = url.searchParams.get("format") || "json"

  const result = await readContext({
    namespaces: ns ? ns.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    scope,
  })
  if ("error" in result) return Response.json({ error: result.error }, { status: 500 })

  // Markdown mode exists so a bot with no JSON-shaping layer (n8n, a Groq prompt
  // template) can drop the whole bundle straight into its system prompt.
  if (format === "md") {
    return new Response(bundleToMarkdown(result.blocks), {
      headers: { ...NO_STORE, "Content-Type": "text/markdown; charset=utf-8" },
    })
  }

  return Response.json(
    { blocks: result.blocks, count: result.blocks.length },
    { headers: NO_STORE },
  )
}

export async function POST(req: Request) {
  const auth = checkIngestAuth(req)
  if (!auth.ok) return authError(auth)

  let body: {
    namespace?: string
    scope?: string
    payload?: Record<string, unknown>
    summary_md?: string
    source?: string
    ttl_minutes?: number
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 })
  }

  if (!body.namespace) {
    return Response.json({ error: "namespace required" }, { status: 400 })
  }

  const result = await writeContext({
    namespace: body.namespace,
    scope: body.scope || "global",
    payload: body.payload ?? {},
    summary_md: body.summary_md ?? "",
    // Falls back to the worker's own name from x-agent-name, so an unlabelled
    // push is still traceable to a caller.
    source: body.source || auth.agent,
    expires_at: body.ttl_minutes ? ttl(body.ttl_minutes) : null,
  })

  if (!result.ok) return Response.json({ error: result.error }, { status: 500 })
  return Response.json({ ok: true }, { headers: NO_STORE })
}
