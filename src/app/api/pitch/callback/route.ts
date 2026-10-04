import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The investor-facing agent and PROXe's outbound number (identifiers, not secrets).
const PITCH_AGENT = process.env.PITCH_AGENT_ID || "agent_2201m434mm0zfgrsqexd5510g8ak";
const PHONE_NUMBER_ID = process.env.ELEVENLABS_PHONE_NUMBER_ID || "phnum_3701m0wakhjte0zr5fyk25yjpe01";

// One call per number per day; per instance, which is enough behind the ARC session.
const recent = new Map<string, number>();

/**
 * POST /api/pitch/callback { phone } — "Call me" on the last pitch card.
 *
 * With ELEVENLABS_API_KEY set on ARC, PROXe calls with the pitch agent, which
 * opens as "you just finished the pitch". Without it, the request is relayed
 * to goproxe.com's call-me flow, which uses the sales agent. Sits behind the
 * ARC session (middleware), like /pitch.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const digits = String(body.phone ?? "").replace(/\D/g, "").replace(/^(91|0)(?=[6-9]\d{9}$)/, "");
  if (!/^[6-9]\d{9}$/.test(digits)) {
    return NextResponse.json({ ok: false, reason: "bad_phone" }, { status: 400 });
  }
  const to = `+91${digits}`;
  const last = recent.get(to);
  if (last && Date.now() - last < 864e5) return NextResponse.json({ ok: false, reason: "recently_called" });

  const key = process.env.ELEVENLABS_API_KEY;
  try {
    if (key) {
      const res = await fetch("https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call", {
        method: "POST",
        headers: { "xi-api-key": key, "content-type": "application/json" },
        body: JSON.stringify({ agent_id: PITCH_AGENT, agent_phone_number_id: PHONE_NUMBER_ID, to_number: to }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) return NextResponse.json({ ok: false, reason: `dial_failed_${res.status}` }, { status: 502 });
      recent.set(to, Date.now());
      return NextResponse.json({ ok: true });
    }
    const res = await fetch("https://goproxe.com/api/callback", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "" },
      body: JSON.stringify({ phone: to, market: "inr", source: "arc_pitch" }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({ ok: false, reason: "bad_response" }));
    if (json.ok) recent.set(to, Date.now());
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, reason: "unreachable" }, { status: 502 });
  }
}
