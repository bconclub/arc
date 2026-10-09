/**
 * What PROXe sends the sales team, read from PROXe's own database (PROXE_DB_URL +
 * PROXE_DB_SERVICE_KEY, the same connection the investor and inbound syncs use).
 * SERVER ONLY.
 *
 * - The live pipeline: proxe_commitment_matrix, PROXe's customers, trials and
 *   prospects with their stage, payment state, next step and commitment scores.
 * - PROXe's knowledge base (knowledge_base): mirrored into team_kb as source
 *   'proxe' so it shows in the Playbook and Ask answers from it.
 */
import { tdb } from "@/lib/team"
import { proxeSyncConfigured } from "@/lib/investor/proxe-sync"

async function proxeRows<T>(path: string): Promise<T[]> {
  const url = process.env.PROXE_DB_URL!, key = process.env.PROXE_DB_SERVICE_KEY!
  const r = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" })
  if (!r.ok) throw new Error(`PROXe answered ${r.status}`)
  return (await r.json()) as T[]
}

export type PipelineRow = {
  id: string; section: "customer" | "prospect" | string; name: string; stage: string | null; card: string | null
  next_step: string | null; position: number; updated_at: string
  words: number | null; actions: number | null
}

const avg = (...n: (number | null)[]) => {
  const v = n.filter((x): x is number => typeof x === "number")
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null
}

/** PROXe's live pipeline: customers and trials first, then prospects, in PROXe's order. */
export async function fetchPipeline(): Promise<{ rows: PipelineRow[]; configured: boolean }> {
  if (!proxeSyncConfigured()) return { rows: [], configured: false }
  type Raw = {
    id: string; section: string; name: string; stage: string | null; card: string | null; next_step: string | null
    position: number | null; updated_at: string
    w_time: number | null; w_effort: number | null; w_money: number | null; a_time: number | null; a_effort: number | null; a_money: number | null
  }
  const raw = await proxeRows<Raw>("proxe_commitment_matrix?select=*&brand=eq.proxe&order=section.asc,position.asc")
  return {
    configured: true,
    rows: raw.map((r) => ({
      id: r.id, section: r.section, name: r.name, stage: r.stage || null, card: r.card || null, next_step: r.next_step || null,
      position: r.position ?? 0, updated_at: r.updated_at,
      // TEMQ: what they said (words) vs what they did (actions), each the mean of time, effort, money (1 to 5).
      words: avg(r.w_time, r.w_effort, r.w_money), actions: avg(r.a_time, r.a_effort, r.a_money),
    })),
  }
}

const KB_SYNCED_KEY = "proxe_kb_synced_at"
const KB_STALE_MS = 10 * 60_000

/**
 * Mirror PROXe's knowledge base into team_kb (source 'proxe', external_id 'kb:<id>').
 * BCON-brand entries go under "BCON Club", PROXe-brand FAQs under FAQ, the rest
 * under "What PROXe is". Entries deleted in PROXe are removed here. Entries the
 * owner wrote in ARC are never touched. With `ifStale`, runs at most every 10 minutes.
 */
export async function syncProxeKnowledge(opts: { ifStale?: boolean } = {}): Promise<{ upserted: number; removed: number; skipped?: string }> {
  if (!proxeSyncConfigured()) return { upserted: 0, removed: 0, skipped: "not configured" }
  if (opts.ifStale) {
    const { data } = await tdb.from("arc_context").select("value").eq("key", KB_SYNCED_KEY).maybeSingle()
    if (data?.value && Date.now() - Date.parse(data.value) < KB_STALE_MS) return { upserted: 0, removed: 0, skipped: "fresh" }
  }
  type K = { id: string; brand: string | null; title: string | null; content: string | null; type: string | null }
  const kb = (await proxeRows<K>("knowledge_base?select=id,brand,title,content,type")).filter((k) => (k.title || k.content || "").trim())

  const rows = kb.map((k, i) => {
    const title = (k.title || "").trim() || (k.content || "").slice(0, 60)
    const faq = /^faq\b/i.test(title)
    const section = (k.brand || "").toLowerCase() === "bcon" ? "bcon" : faq ? "faq" : "product"
    return {
      section, title: title.replace(/^faq\s*[-:]\s*/i, "").slice(0, 200), body: (k.content || "").slice(0, 20000),
      tags: [k.brand || "", faq ? "faq" : ""].filter(Boolean), position: 100 + i,
      source: "proxe", external_id: `kb:${k.id}`,
    }
  })
  if (rows.length) {
    const { error } = await tdb.from("team_kb").upsert(rows, { onConflict: "source,external_id" })
    if (error) throw new Error(error.message)
  }
  // Remove mirrored entries PROXe no longer has (only 'kb:' ones; pushes use their own ids).
  const keep = new Set(rows.map((r) => r.external_id))
  const { data: mine } = await tdb.from("team_kb").select("id,external_id").eq("source", "proxe").like("external_id", "kb:%")
  const gone = ((mine || []) as { id: string; external_id: string }[]).filter((m) => !keep.has(m.external_id)).map((m) => m.id)
  if (gone.length) await tdb.from("team_kb").delete().in("id", gone)

  const now = new Date().toISOString()
  await tdb.from("arc_context").upsert({ key: KB_SYNCED_KEY, value: now, updated_at: now })
  return { upserted: rows.length, removed: gone.length }
}
