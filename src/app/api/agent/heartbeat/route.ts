// Liveness. A dead mail agent and a quiet inbox look identical from ARC's side —
// this is what tells them apart.
//
// POST /api/agent/heartbeat  { "version": "0.1.0", "note": "idle" }
// GET  /api/agent/heartbeat  -> liveness for every known agent (stale = >12h silent)
import { supabaseAdmin } from "@/lib/supabase"
import { checkIngestAuth, authError } from "@/lib/ingest-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const auth = checkIngestAuth(req)
  if (!auth.ok) return authError(auth)

  const body = await req.json().catch(() => ({}))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any).from("agent_heartbeats").upsert(
    {
      agent: auth.agent,
      last_seen: new Date().toISOString(),
      version: body.version || null,
      note: body.note || null,
      healthy: body.healthy !== false,
    },
    { onConflict: "agent" }
  )
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any).from("agent_liveness").select("*")
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data || [], { headers: { "Cache-Control": "no-store" } })
}
