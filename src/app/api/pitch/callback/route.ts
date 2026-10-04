import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/pitch/callback { phone } — "Get a call" on the last pitch card.
 *
 * goproxe.com already runs the call-me flow (ElevenLabs agent, one call per
 * number per day, India numbers only). It has no CORS for other origins, so
 * ARC relays server side instead of holding any voice keys itself. The route
 * sits behind the ARC session (middleware), like /pitch.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = String(body.phone ?? "").replace(/[^\d+]/g, "");
  if (!/^(\+?91|0)?[6-9]\d{9}$/.test(phone)) {
    return NextResponse.json({ ok: false, reason: "bad_phone" }, { status: 400 });
  }
  try {
    const res = await fetch("https://goproxe.com/api/callback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Their per-IP limit should see the visitor, not ARC's server.
        "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "",
      },
      body: JSON.stringify({ phone, market: "inr", source: "arc_pitch" }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({ ok: false, reason: "bad_response" }));
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, reason: "unreachable" }, { status: 502 });
  }
}
