import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME, STUDIO_COOKIE, TEAM_COOKIE, TEAM_DAYS, createSessionToken, createStudioToken, createTeamToken,
  verifyHash, verifyPassword, verifyStudioPassword,
} from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// Three ways in. With a username: a team member's own account (team_members),
// landing on /team. Without one: the owner password opens everything, the studio
// password (STUDIO_PASSWORD_HASH, optional) only the Studio. Each login clears
// the other cookies so a shared browser never holds two.
const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};
const clear = { path: "/", maxAge: 0 };

export async function POST(req: NextRequest) {
  const { password, username } = await req.json().catch(() => ({ password: "", username: "" }));
  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  if (typeof username === "string" && username.trim()) {
    // Login names are letters, digits and dots only (enforced at creation), so ilike is an exact, case-blind match.
    if (!/^[a-z0-9.]{2,32}$/i.test(username.trim())) return NextResponse.json({ error: "Wrong name or password" }, { status: 401 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: m } = await (supabaseAdmin as any).from("team_members")
      .select("id,password_hash,active").ilike("username", username.trim()).maybeSingle();
    // Hash anyway on a miss so a wrong name and a wrong password take the same time.
    const ok = await verifyHash(password, m?.password_hash || "00:00");
    if (!m || !m.active || !ok) return NextResponse.json({ error: "Wrong name or password" }, { status: 401 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("team_members").update({ last_login_at: new Date().toISOString() }).eq("id", m.id);
    const res = NextResponse.json({ ok: true, role: "team", home: "/team" });
    res.cookies.set(TEAM_COOKIE, await createTeamToken(m.id), { ...cookieOpts, maxAge: 60 * 60 * 24 * TEAM_DAYS });
    res.cookies.set(COOKIE_NAME, "", clear);
    res.cookies.set(STUDIO_COOKIE, "", clear);
    return res;
  }

  if (await verifyPassword(password)) {
    const res = NextResponse.json({ ok: true, role: "owner" });
    res.cookies.set(COOKIE_NAME, await createSessionToken(), cookieOpts);
    res.cookies.set(STUDIO_COOKIE, "", clear);
    res.cookies.set(TEAM_COOKIE, "", clear);
    return res;
  }
  if (await verifyStudioPassword(password)) {
    const res = NextResponse.json({ ok: true, role: "studio", home: "/dashboard/studio" });
    res.cookies.set(STUDIO_COOKIE, await createStudioToken(), cookieOpts);
    res.cookies.set(COOKIE_NAME, "", clear);
    res.cookies.set(TEAM_COOKIE, "", clear);
    return res;
  }
  return NextResponse.json({ error: "Wrong password" }, { status: 401 });
}
