// Bearer auth for machine callers (Luko on the VPS, and anything after it).
//
// The dashboard is cookie-gated for humans; agents get a shared secret instead. Fail
// closed: if ARC_INGEST_SECRET isn't set, machine writes are refused outright rather
// than falling open. Routes using this MUST also be exempted in src/middleware.ts,
// or the cookie gate returns 401 before the handler ever runs.

export type AuthFailure = { ok: false; status: 401 | 503; error: string }
export type AuthSuccess = { ok: true; agent: string }

// `fleet` routes (heartbeat, next, result) also take ARC_FLEET_SECRET: the key every
// machine's session reporter carries (workers/fleet). It opens only those routes, so
// a leaked reporter config can't reach outreach, briefs or anything else.
export function checkIngestAuth(req: Request, opts: { fleet?: boolean } = {}): AuthFailure | AuthSuccess {
  const secret = process.env.ARC_INGEST_SECRET
  const fleetSecret = opts.fleet ? process.env.ARC_FLEET_SECRET : undefined
  if (!secret && !fleetSecret) {
    return { ok: false, status: 503, error: "ingest disabled (no ARC_INGEST_SECRET)" }
  }
  const header = req.headers.get("authorization")
  const okMain = !!secret && header === `Bearer ${secret}`
  const okFleet = !!fleetSecret && header === `Bearer ${fleetSecret}`
  if (!okMain && !okFleet) {
    return { ok: false, status: 401, error: "unauthorized" }
  }
  // Identifies which worker is calling — used for job claims and heartbeats.
  const agent = req.headers.get("x-agent-name") || "unknown"
  return { ok: true, agent }
}

export function authError(fail: AuthFailure): Response {
  return Response.json({ error: fail.error }, { status: fail.status })
}
