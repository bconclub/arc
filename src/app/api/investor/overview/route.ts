import { NextRequest, NextResponse } from "next/server";
import { resolveViewer } from "@/lib/investor/viewer";
import { buildInvestorOverview } from "@/lib/investor/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

const RANGES = new Set([7, 30, 90]);

/** GET /api/investor/overview?days=30 — the whole investor view, PROXe only. */
export async function GET(req: NextRequest) {
  const viewer = await resolveViewer(req.cookies, req.nextUrl.searchParams.get("as"));
  if (!viewer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const asked = Number(req.nextUrl.searchParams.get("days"));
  const days = RANGES.has(asked) ? asked : 30;

  const data = await buildInvestorOverview(viewer, days);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
