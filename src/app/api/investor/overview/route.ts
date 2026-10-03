import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { resolveViewer } from "@/lib/investor/viewer";
import { buildInvestorOverview } from "@/lib/investor/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

// 3650 is "all time": ten years reaches past the company's first day.
const RANGES = new Set([7, 30, 90, 3650]);

/** GET /api/investor/overview?days=30 — the whole investor view, PROXe only. */
export async function GET(req: NextRequest) {
  const viewer = await resolveViewer(req.cookies, req.nextUrl.searchParams.get("as"));
  if (!viewer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const asked = Number(req.nextUrl.searchParams.get("days"));
  const days = RANGES.has(asked) ? asked : 3650;

  // Two minutes per viewer and window: tab switches and reopenings are
  // instant, and nothing on the page moves faster than that.
  const who = viewer.role === "owner" ? "owner" : viewer.investor.id;
  const t0 = Date.now();
  const data = await unstable_cache(
    () => buildInvestorOverview(viewer, days),
    ["investor-overview", who, String(days)],
    { revalidate: 120 },
  )();
  console.log(`[investor] overview ${who} ${days}d ${Date.now() - t0}ms`);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
