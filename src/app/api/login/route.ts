import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME, STUDIO_COOKIE, TEAM_COOKIE, TEAM_DAYS, createSessionToken, createStudioToken, createTeamToken,
  verifyHash, verifyPassword, verifyStudioPassword,
} from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { homeFor } from "@/lib/access";

// Three ways in. With a username: a team member's own account (team_members),
// landing on their first area (Studio or the sales view, see lib/access.ts). Without one: the owner password opens everything, the studio
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

/** The owner password from env, or the admin password stored in the database. */
async function verifyAdminPassword(password: string): Promise<boolean> {
  if (await verifyPassword(password).catch(() => false)) return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any).from("arc_context").select("value").eq("key", "admin_password_hash").maybeSingle();
  return data?.value ? verifyHash(password, data.value as string) : false;
}

export async function POST(req: NextRequest) {
  const { password, username } = await req.json().catch(() => ({ password: "", username: "" }));
  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  // The owner's own login names: brands@bconclub.com, proxe@goproxe.com, plus any in ADMIN_USERNAME. Full access. The password
  // is the owner password (DASHBOARD_PASSWORD_HASH) or the admin password kept in
  // arc_context 'admin_password_hash', so the owner can be given a new one without
  // touching Vercel env.
  const adminNames = ["brands@bconclub.com", "proxe@goproxe.com", ...(process.env.ADMIN_USERNAME || "").split(",")]
    .map((s) => s.trim().toLowerCase()).filter(Boolean);
  const name = typeof username === "string" ? username.trim().toLowerCase() : "";
  if (adminNames.includes(name)) {
    if (!(await verifyAdminPassword(password))) return NextResponse.json({ error: "Wrong name or password" }, { status: 401 });
    const res = NextResponse.json({ ok: true, role: "owner" });
    res.cookies.set(COOKIE_NAME, await createSessionToken(), cookieOpts);
    res.cookies.set(STUDIO_COOKIE, "", clear);
    res.cookies.set(TEAM_COOKIE, "", clear);
    return res;
  }

  if (typeof username === "string" && username.trim()) {
    // Login names are letters, digits and dots only (enforced at creation), so ilike is an exact, case-blind match.
    if (!/^[a-z0-9.]{2,32}$/i.test(username.trim())) return NextResponse.json({ error: "Wrong name or password" }, { status: 401 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: m } = await (supabaseAdmin as any).from("team_members")
      .select("id,password_hash,active,access").ilike("username", username.trim()).maybeSingle();
    // Hash anyway on a miss so a wrong name and a wrong password take the same time.
    const ok = await verifyHash(password, m?.password_hash || "00:00");
    if (!m || !m.active || !ok || !m.access?.length) return NextResponse.json({ error: "Wrong name or password" }, { status: 401 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("team_members").update({ last_login_at: new Date().toISOString() }).eq("id", m.id);
    const res = NextResponse.json({ ok: true, role: "team", home: homeFor(m.access) });
    res.cookies.set(TEAM_COOKIE, await createTeamToken(m.id), { ...cookieOpts, maxAge: 60 * 60 * 24 * TEAM_DAYS });
    res.cookies.set(COOKIE_NAME, "", clear);
    res.cookies.set(STUDIO_COOKIE, "", clear);
    return res;
  }

  if (await verifyAdminPassword(password)) {
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
