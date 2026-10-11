// Liveness. A dead mail agent and a quiet inbox look identical from ARC's side —
// this is what tells them apart.
//
// POST /api/agent/heartbeat  { "version": "0.1.0", "note": "idle" }
// Fleet members (machines, Claude sessions, the hub) add who and what they are, and
// a running job's progress rides along in the same call:
//   { "machine": "bcon-main", "kind": "worker", "capabilities": ["gpu", "ffmpeg"],
//     "status": "working", "job_id": "uuid", "progress": 40, "stage": "encode",
//     "log_tail": "frame= 1200 fps=58" }
// GET  /api/agent/heartbeat          -> liveness for every known agent (stale = >12h silent)
// GET  /api/agent/heartbeat?fleet=1  -> fleet_status (stale = >10min silent)
import { supabaseAdmin } from "@/lib/supabase"
import { checkIngestAuth, authError } from "@/lib/ingest-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const FLEET_FIELDS = ["machine", "kind", "project", "status", "capabilities", "progress"] as const

export async function POST(req: Request) {
  const auth = checkIngestAuth(req, { fleet: true })
  if (!auth.ok) return authError(auth)

  const body = await req.json().catch(() => ({}))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabaseAdmin as any

  const row: Record<string, unknown> = {
    agent: auth.agent,
    last_seen: new Date().toISOString(),
    version: body.version || null,
    note: body.note || null,
    healthy: body.healthy !== false,
  }
  // Only fields the caller sent — a plain {note} beat must not wipe a worker's capabilities.
  for (const f of FLEET_FIELDS) if (body[f] !== undefined) row[f] = body[f]
  if (body.job_id !== undefined) row.current_job = body.job_id || null

  const { error } = await sb.from("agent_heartbeats").upsert(row, { onConflict: "agent" })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (body.job_id && (body.progress !== undefined || body.stage !== undefined || body.log_tail !== undefined)) {
    const patch: Record<string, unknown> = {}
    if (body.progress !== undefined) patch.progress = body.progress
    if (body.stage !== undefined) patch.stage = body.stage
    if (body.log_tail !== undefined) patch.log_tail = String(body.log_tail).slice(-2000)
    await sb.from("agent_jobs").update(patch).eq("id", body.job_id).eq("claimed_by", auth.agent)
  }

  return Response.json({ ok: true })
}

export async function GET(req: Request) {
  const fleet = new URL(req.url).searchParams.has("fleet")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = (supabaseAdmin as any).from(fleet ? "fleet_status" : "agent_liveness").select("*")
  const { data, error } = fleet ? await q.order("machine").order("agent") : await q
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data || [], { headers: { "Cache-Control": "no-store" } })
}
