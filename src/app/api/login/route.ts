import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME, STUDIO_COOKIE, createSessionToken, createStudioToken, verifyPassword, verifyStudioPassword,
} from "@/lib/auth";

// Two passwords, two roles. The owner password opens everything; the studio password
// (STUDIO_PASSWORD_HASH, optional) opens only the Studio. Each login clears the other
// cookie so a shared browser never holds both.
const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  if (await verifyPassword(password)) {
    const res = NextResponse.json({ ok: true, role: "owner" });
    res.cookies.set(COOKIE_NAME, await createSessionToken(), cookieOpts);
    res.cookies.set(STUDIO_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }
  if (await verifyStudioPassword(password)) {
    const res = NextResponse.json({ ok: true, role: "studio", home: "/dashboard/studio" });
    res.cookies.set(STUDIO_COOKIE, await createStudioToken(), cookieOpts);
    res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
    return res;
  }
  return NextResponse.json({ error: "Wrong password" }, { status: 401 });
}
