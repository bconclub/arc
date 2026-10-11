// Fleet control center data + actions. Cookie-gated by middleware.
//
// GET  -> { machines, members, jobs }   members = fleet_status rows (sessions, workers, hub)
// POST { action: "queue", type, brief, target? }        -> queue a render / Claude job
// POST { action: "message", to, text }                  -> hub delivers it to that session
// POST { action: "cancel" | "retry", job_id }
import { supabaseAdmin } from "@/lib/supabase"
import { MACHINES, JOB_TYPES, HUB_MESSAGE } from "@/lib/fleet"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any

const JOB_COLS =
  "id, kind, payload, status, priority, run_at, claimed_by, claimed_at, attempts, max_attempts, error, required_capability, progress, stage, log_tail, created_at, updated_at"

export async function GET() {
  const [members, active, recent] = await Promise.all([
    db.from("fleet_status").select("*").order("machine").order("agent"),
    db.from("agent_jobs").select(JOB_COLS).in("status", ["queued", "running"]).order("created_at", { ascending: false }).limit(100),
    db.from("agent_jobs").select(JOB_COLS).in("status", ["done", "failed", "cancelled"]).order("updated_at", { ascending: false }).limit(30),
  ])
  const err = members.error || active.error || recent.error
  if (err) return Response.json({ error: err.message }, { status: 500 })

  return Response.json(
    { machines: MACHINES, members: members.data || [], jobs: [...(active.data || []), ...(recent.data || [])] },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))

  if (body.action === "queue") {
    const t = JOB_TYPES.find((x) => x.value === body.type)
    const brief = String(body.brief || "").trim()
    if (!t) return Response.json({ error: "unknown job type" }, { status: 400 })
    if (!brief) return Response.json({ error: "say what the job should do" }, { status: 400 })
    // A specific machine is just a stricter capability: only that machine lists itself.
    const target = MACHINES.find((m) => m.slug === body.target)
    const { data, error } = await db
      .from("agent_jobs")
      .insert({
        kind: t.kind,
        payload: { type: t.value, brief, target: target?.slug ?? null, from: "control-center" },
        required_capability: target ? `machine:${target.slug}` : t.capability,
      })
      .select(JOB_COLS)
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ job: data })
  }

  if (body.action === "message") {
    const to = String(body.to || "").trim()
    const text = String(body.text || "").trim()
    if (!to || !text) return Response.json({ error: "to and text required" }, { status: 400 })
    const { data, error } = await db
      .from("agent_jobs")
      .insert({ kind: HUB_MESSAGE, payload: { to, text, from: "control-center" }, priority: 10 })
      .select(JOB_COLS)
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ job: data })
  }

  if (body.action === "cancel" || body.action === "retry") {
    if (!body.job_id) return Response.json({ error: "job_id required" }, { status: 400 })
    const patch =
      body.action === "cancel"
        ? { status: "cancelled" }
        : { status: "queued", run_at: new Date().toISOString(), error: null, claimed_by: null, progress: null, stage: null }
    const from = body.action === "cancel" ? ["queued", "running"] : ["failed", "cancelled"]
    const { data, error } = await db.from("agent_jobs").update(patch).eq("id", body.job_id).in("status", from).select(JOB_COLS)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!data?.length) return Response.json({ error: `job is not ${from.join(" or ")}` }, { status: 409 })
    return Response.json({ job: data[0] })
  }

  return Response.json({ error: "unknown action" }, { status: 400 })
}
