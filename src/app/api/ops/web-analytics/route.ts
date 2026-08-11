import { NextRequest, NextResponse } from "next/server";
import { fetchGa4 } from "@/lib/analytics/ga4";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * GET /api/ops/web-analytics?days=30
 *
 * Same contract as the ads route: "not connected" and "connected but failing"
 * are reported separately, because one needs credentials and the other needs
 * fixing.
 */
export async function GET(req: NextRequest) {
  const hasAuth = !!(process.env.GA4_SERVICE_ACCOUNT_JSON
    || (process.env.GA4_CLIENT_ID && process.env.GA4_CLIENT_SECRET && process.env.GA4_REFRESH_TOKEN));
  const hasProperty = !!process.env.GA4_PROPERTY_ID;

  if (!hasAuth || !hasProperty) {
    const missing = [
      !hasProperty && "GA4_PROPERTY_ID",
      !hasAuth && "GA4_SERVICE_ACCOUNT_JSON (or the GA4_CLIENT_ID/SECRET/REFRESH_TOKEN trio)",
    ].filter(Boolean);
    return NextResponse.json({
      configured: false,
      error: null,
      detail: `Not connected. Missing ${missing.join(" and ")}.`,
      data: null,
    });
  }

  const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get("days") ?? 30) || 30));
  try {
    return NextResponse.json({ configured: true, error: null, data: await fetchGa4(days) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not reach Google Analytics.";
    return NextResponse.json({ configured: true, error: message, data: null });
  }
}
