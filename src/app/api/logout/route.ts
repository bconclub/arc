import { NextResponse } from "next/server";
import { COOKIE_NAME, STUDIO_COOKIE, TEAM_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  res.cookies.set(STUDIO_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(TEAM_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
