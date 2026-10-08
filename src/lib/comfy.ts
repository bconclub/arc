// Comfy Cloud: the clips we generated there and what they cost. Read live from the
// Comfy Cloud API (experimental, Creator/Pro tiers) with COMFY_API_KEY, so nothing is stored.
// Docs: https://docs.comfy.org/api-reference/cloud (spec: docs.comfy.org/openapi-cloud.yaml)

const BASE = process.env.COMFY_API_BASE || "https://cloud.comfy.org"
const PAGE = 1000
const MAX_JOBS = 10_000

export type ComfyJob = {
  id: string; status: string; create_time: number; outputs_count?: number; workflow_id?: string
  execution_start_time?: number; execution_end_time?: number
  preview_output?: Record<string, unknown>
}
type Bucket = { period_start: string; period_end: string; group_key: string; cost_micros: number }
type Breakdown = { group_key: string; cost_micros: number; share: number }
type Usage = {
  buckets: Bucket[]; breakdown: Breakdown[]
  summary: { spend_micros: number; balance?: { amount_micros: number; currency: string } }
}

export type Clip = {
  id: string; status: string; created: string; day: string; file: string | null
  run_seconds: number; outputs: number; est_cost_usd: number | null
}

async function get<T>(path: string, key: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { headers: { "X-API-Key": key }, cache: "no-store" })
  if (!r.ok) {
    const j = await r.json().catch(() => ({}))
    throw new Error(`Comfy ${path.split("?")[0]} ${r.status}: ${j.message || r.statusText}`)
  }
  return r.json()
}

async function allJobs(key: string, outputType?: "video") {
  const jobs: ComfyJob[] = []
  for (let offset = 0; offset < MAX_JOBS; offset += PAGE) {
    const q = new URLSearchParams({ limit: String(PAGE), offset: String(offset), sort_order: "desc" })
    if (outputType) q.set("output_type", outputType)
    const r = await get<{ jobs: ComfyJob[]; pagination: { has_more: boolean } }>(`/api/jobs?${q}`, key)
    jobs.push(...r.jobs)
    if (!r.pagination?.has_more) break
  }
  return jobs
}

const runSec = (j: ComfyJob) =>
  j.execution_start_time && j.execution_end_time ? Math.max(0, (j.execution_end_time - j.execution_start_time) / 1000) : 0
const dayOf = (j: ComfyJob) => new Date(j.create_time * 1000).toISOString().slice(0, 10)
const fileOf = (j: ComfyJob) => {
  const p = j.preview_output
  return p && typeof p.filename === "string" ? p.filename : null
}

/**
 * Clips (video jobs), spend by model and by day, and the balance.
 * Comfy bills per day per model, not per job, so a clip's cost is an estimate: its day's spend
 * shared across that day's jobs by run time. Totals are exact; per-clip figures are not.
 */
export async function comfyReport(months = 12) {
  const key = process.env.COMFY_API_KEY
  if (!key) return { configured: false as const }

  const [all, videos, byModel] = await Promise.all([
    allJobs(key),
    allJobs(key, "video"),
    get<Usage>(`/api/billing/usage/timeseries?group_by=model&granularity=day&months=${months}`, key),
  ])

  const spendByDay = new Map<string, number>()
  for (const b of byModel.buckets) {
    const d = b.period_start.slice(0, 10)
    spendByDay.set(d, (spendByDay.get(d) || 0) + b.cost_micros / 1e6)
  }
  const runByDay = new Map<string, number>()
  for (const j of all) runByDay.set(dayOf(j), (runByDay.get(dayOf(j)) || 0) + runSec(j))

  const clips: Clip[] = videos.map((j) => {
    const day = dayOf(j), spend = spendByDay.get(day), run = runByDay.get(day) || 0
    return {
      id: j.id, status: j.status, created: new Date(j.create_time * 1000).toISOString(), day,
      file: fileOf(j), run_seconds: runSec(j), outputs: j.outputs_count || 0,
      est_cost_usd: spend == null ? null : run > 0 ? spend * (runSec(j) / run) : null,
    }
  })

  const done = clips.filter((c) => c.status === "completed")
  const days = Array.from(spendByDay.entries()).sort(([a], [b]) => a.localeCompare(b))
    .map(([day, usd]) => ({ day, usd, clips: done.filter((c) => c.day === day).length }))
  const bal = byModel.summary.balance

  return {
    configured: true as const,
    total_spend_usd: byModel.summary.spend_micros / 1e6,
    balance: bal ? { amount: bal.amount_micros / 100, currency: bal.currency } : null,
    months,
    jobs: { total: all.length, completed: all.filter((j) => j.status === "completed").length, failed: all.filter((j) => j.status === "failed").length },
    clips_completed: done.length,
    clips_failed: clips.filter((c) => c.status === "failed").length,
    clip_seconds_run: done.reduce((s, c) => s + c.run_seconds, 0),
    by_model: byModel.breakdown.map((b) => ({ model: b.group_key, usd: b.cost_micros / 1e6, share: b.share })),
    days,
    clips,
  }
}
