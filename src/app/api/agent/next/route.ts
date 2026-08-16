// Claim the next job. Workers pull from here — ARC decides what needs doing, the
// worker just does it and reports back via /api/agent/result.
//
// POST /api/agent/next  { "kinds": ["scan_mail"] }   -> one job, or null when idle
import { supabaseAdmin } from "@/lib/supabase"
import { checkIngestAuth, authError } from "@/lib/ingest-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const auth = checkIngestAuth(req)
  if (!auth.ok) return authError(auth)

  const body = await req.json().catch(() => ({}))
  const kinds = Array.isArray(body.kinds) && body.kinds.length ? body.kinds : null

  // claim_agent_job uses FOR UPDATE SKIP LOCKED, so two workers never take the same row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any).rpc("claim_agent_job", {
    worker: auth.agent,
    kinds,
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const job = Array.isArray(data) ? data[0] : data
  return Response.json({ job: job || null }, { headers: { "Cache-Control": "no-store" } })
}
