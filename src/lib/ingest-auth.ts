// Bearer auth for machine callers (Luko on the VPS, and anything after it).
//
// The dashboard is cookie-gated for humans; agents get a shared secret instead. Fail
// closed: if ARC_INGEST_SECRET isn't set, machine writes are refused outright rather
// than falling open. Routes using this MUST also be exempted in src/middleware.ts,
// or the cookie gate returns 401 before the handler ever runs.

export type AuthFailure = { ok: false; status: 401 | 503; error: string }
export type AuthSuccess = { ok: true; agent: string }

export function checkIngestAuth(req: Request): AuthFailure | AuthSuccess {
  const secret = process.env.ARC_INGEST_SECRET
  if (!secret) {
    return { ok: false, status: 503, error: "ingest disabled (no ARC_INGEST_SECRET)" }
  }
  const header = req.headers.get("authorization")
  if (header !== `Bearer ${secret}`) {
    return { ok: false, status: 401, error: "unauthorized" }
  }
  // Identifies which worker is calling — used for job claims and heartbeats.
  const agent = req.headers.get("x-agent-name") || "unknown"
  return { ok: true, agent }
}

export function authError(fail: AuthFailure): Response {
  return Response.json({ error: fail.error }, { status: fail.status })
}
