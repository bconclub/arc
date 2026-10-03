import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { INVESTOR_COOKIE, INVESTOR_DAYS, createInvestorToken, verifyHash } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A real hash of a throwaway string. An unknown username still pays the full
// PBKDF2 cost, so response time does not reveal which usernames exist.
const DECOY = "6a1f0c2d9e8b7a6f5e4d3c2b1a0f9e8d:" + "0".repeat(64);

const FAIL = { error: "Wrong username or password." };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!username || !password) return NextResponse.json(FAIL, { status: 401 });

  const { data: inv } = await supabaseAdmin
    .from("investors")
    .select("id,password_hash,active")
    .eq("username", username)
    .maybeSingle();

  const ok = await verifyHash(password, inv?.password_hash ?? DECOY);
  if (!inv || !ok || !inv.active) {
    // Flat delay on every failure blunts guessing without a lockout table.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json(FAIL, { status: 401 });
  }

  await supabaseAdmin.from("investors").update({ last_login_at: new Date().toISOString() }).eq("id", inv.id);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(INVESTOR_COOKIE, await createInvestorToken(inv.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * INVESTOR_DAYS,
  });
  return res;
}
