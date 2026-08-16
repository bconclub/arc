// Report a job outcome, and optionally persist the worker's cursor in the same call.
//
// POST /api/agent/result
// {
//   "job_id": "uuid", "status": "done" | "failed",
//   "result": { ... }, "error": "…",
//   "state": { "scope": "gmail:brands@bconclub.com", "cursor": "12345", "seen": [...] },
//   "next": { "kind": "scan_mail", "run_at": "2026-07-29T02:00:00Z", "payload": {} }
// }
//
// The cursor lives in ARC, not on the VPS, so a rebuilt container resumes where it
// left off instead of re-scanning (and re-inserting) mail it already handled.
import { supabaseAdmin } from "@/lib/supabase"
import { checkIngestAuth, authError } from "@/lib/ingest-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const auth = checkIngestAuth(req)
  if (!auth.ok) return authError(auth)

  let body: {
    job_id?: string
    status?: string
    result?: Record<string, unknown>
    error?: string
    state?: { scope?: string; cursor?: string; seen?: unknown[]; meta?: Record<string, unknown> }
    next?: { kind?: string; run_at?: string; payload?: Record<string, unknown>; idempotency_key?: string }
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 })
  }

  if (!body.job_id) return Response.json({ error: "job_id required" }, { status: 400 })
  const status = body.status === "failed" ? "failed" : "done"

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabaseAdmin as any

  const { data: job, error: jobErr } = await sb
    .from("agent_jobs")
    .update({ status, result: body.result || {}, error: body.error || null })
    .eq("id", body.job_id)
    .select()
    .single()
  if (jobErr) return Response.json({ error: jobErr.message }, { status: 500 })

  // Retry budget: a failure that still has attempts left goes back on the queue.
  let requeued = false
  if (status === "failed" && job && job.attempts < job.max_attempts) {
    const backoffMin = Math.pow(2, job.attempts) * 5
    const { error } = await sb
      .from("agent_jobs")
      .update({ status: "queued", run_at: new Date(Date.now() + backoffMin * 60_000).toISOString() })
      .eq("id", body.job_id)
    requeued = !error
  }

  if (body.state?.scope) {
    await sb.from("agent_state").upsert(
      {
        agent: auth.agent,
        scope: body.state.scope,
        cursor: body.state.cursor ?? null,
        seen: body.state.seen ?? [],
        meta: body.state.meta ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "agent,scope" }
    )
  }

  if (body.next?.kind) {
    await sb.from("agent_jobs").insert({
      kind: body.next.kind,
      payload: body.next.payload || {},
      run_at: body.next.run_at || new Date().toISOString(),
      idempotency_key: body.next.idempotency_key || null,
    })
  }

  return Response.json({ ok: true, status, requeued })
}
