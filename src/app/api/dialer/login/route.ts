import { NextResponse } from "next/server";
import { COOKIE_NAME, STUDIO_COOKIE, TEAM_COOKIE, TEAM_DAYS, createTeamToken, verifyHash } from "@/lib/auth";
import { db } from "@/lib/dialer/members";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Passcode sign-in for the dialer: each caller has their own 6-digit passcode
 * (set by the owner); typing it at /dialer signs them in as themselves.
 *
 * A passcode with no name is a small secret, so wrong tries are counted across
 * everyone: after 5 in a row the door stays shut for 15 minutes.
 */
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60_000;

export async function POST(req: Request) {
  const b = await req.json().catch(() => null) as { pin?: string } | null;
  const pin = String(b?.pin || "").replace(/\D/g, "");
  if (pin.length !== 6) return NextResponse.json({ error: "Enter your 6-digit passcode." }, { status: 400 });

  const { data: gateRow } = await db.from("dialer_settings").select("value").eq("key", "pin_gate").maybeSingle();
  const gate = (gateRow?.value || {}) as { fails?: number; until?: string };
  if (gate.until && Date.parse(gate.until) > Date.now()) {
    const mins = Math.ceil((Date.parse(gate.until) - Date.now()) / 60_000);
    return NextResponse.json({ error: `Too many wrong tries. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` }, { status: 429 });
  }

  const { data: members } = await db.from("team_members").select("id,name,access,dialer_pin_hash").eq("active", true).not("dialer_pin_hash", "is", null);
  let hit: { id: string; name: string } | null = null;
  for (const m of (members || []) as { id: string; name: string; access: string[] | null; dialer_pin_hash: string }[]) {
    // Check every one (no early exit), so the time taken says nothing about who matched.
    const ok = await verifyHash(pin, m.dialer_pin_hash);
    if (ok && m.access?.includes("sales") && !hit) hit = { id: m.id, name: m.name };
  }

  if (!hit) {
    const fails = (gate.fails || 0) + 1;
    const value = fails >= MAX_FAILS ? { fails: 0, until: new Date(Date.now() + LOCK_MS).toISOString() } : { fails };
    await db.from("dialer_settings").upsert({ key: "pin_gate", value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    return NextResponse.json({ error: "That passcode is not right." }, { status: 401 });
  }

  if (gate.fails) await db.from("dialer_settings").upsert({ key: "pin_gate", value: { fails: 0 }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  await db.from("team_members").update({ last_login_at: new Date().toISOString() }).eq("id", hit.id);
  const res = NextResponse.json({ ok: true, name: hit.name });
  res.cookies.set(TEAM_COOKIE, await createTeamToken(hit.id), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * TEAM_DAYS });
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  res.cookies.set(STUDIO_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
