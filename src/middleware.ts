import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";

// api/agent/* and api/proxe/briefs are machine endpoints — they carry their own
// bearer check (see lib/ingest-auth.ts) and fail closed without ARC_INGEST_SECRET.
// Leaving them out of this matcher exemption is not a safe default: it makes them
// 401 on the session gate before their own auth ever runs.
//
// api/public is read by goproxe.com/pitch: live plan and round numbers only.
// studio/<slug> is a client's view of one brand board; it needs the board's secret
// share key (?k=) and shows ideas and images only. See api/public/studio.
//
// investor and api/investor are the investor portal: their own login, their own
// cookie, checked in lib/investor/viewer.ts. The owner session still opens them
// as a preview; nothing an investor holds passes the gate below.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|login|api/login|api/arc/sync|api/agent|api/proxe/briefs|investor|api/investor|api/public|studio/|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)",
  ],
};

/**
 * Paths Vercel Cron calls. A cron request carries no session cookie, so it is
 * let through on a shared secret instead. GET only: the dashboard's own Sync
 * button posts to the same route and must keep needing a real session.
 *
 * Fail-closed on purpose. With CRON_SECRET unset nothing gets through, which is
 * the right failure for a route that spends money on model calls per
 * attachment: an open URL would let anyone run up the API bill.
 */
const CRON_PATHS = [
  "/api/ops/invoices/scan",
  "/api/arc/context-sync",
  "/api/arc/morning-brief",
];

function isAuthorisedCron(req: NextRequest): boolean {
  if (req.method !== "GET") return false;
  if (!CRON_PATHS.includes(req.nextUrl.pathname)) return false;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function middleware(req: NextRequest) {
  if (isAuthorisedCron(req)) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const valid = await verifySessionToken(token);
  if (valid) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
