// Claim the next job. Workers pull from here — ARC decides what needs doing, the
// worker just does it and reports back via /api/agent/result.
//
// POST /api/agent/next  { "kinds": ["scan_mail"] }   -> one job, or null when idle
// Fleet workers also send what they can run; jobs with a required_capability only go
// to a worker that lists it:  { "kinds": ["render"], "caps": ["gpu", "ffmpeg"] }
import { supabaseAdmin } from "@/lib/supabase"
import { checkIngestAuth, authError } from "@/lib/ingest-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const auth = checkIngestAuth(req, { fleet: true })
  if (!auth.ok) return authError(auth)

  const body = await req.json().catch(() => ({}))
  const kinds = Array.isArray(body.kinds) && body.kinds.length ? body.kinds : null
  const caps = Array.isArray(body.caps) && body.caps.length ? body.caps : null

  // claim_agent_job uses FOR UPDATE SKIP LOCKED, so two workers never take the same row.
  // caps only when sent, so callers without it work against the pre-fleet function too.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any).rpc("claim_agent_job", {
    worker: auth.agent,
    kinds,
    ...(caps ? { caps } : {}),
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const job = Array.isArray(data) ? data[0] : data
  return Response.json({ job: job || null }, { headers: { "Cache-Control": "no-store" } })
}
