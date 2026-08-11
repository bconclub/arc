import { NextRequest, NextResponse } from "next/server";
import { fetchMetaAds } from "@/lib/ads/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * GET /api/ops/ads?range=last_30d
 *
 * Returns `configured: false` rather than an error when the credentials are
 * absent, so the panel can say "not connected" instead of "something broke".
 * Those are different states and the fix is different for each.
 */
export async function GET(req: NextRequest) {
  const configured = !!(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
  if (!configured) {
    const missing = [
      !process.env.META_ACCESS_TOKEN && "META_ACCESS_TOKEN",
      !process.env.META_AD_ACCOUNT_ID && "META_AD_ACCOUNT_ID",
    ].filter(Boolean);
    return NextResponse.json({
      configured: false,
      error: null,
      detail: `Not connected. Missing ${missing.join(" and ")}.`,
      data: null,
    });
  }

  const range = req.nextUrl.searchParams.get("range") ?? "last_30d";
  try {
    return NextResponse.json({ configured: true, error: null, data: await fetchMetaAds(range) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not reach Meta.";
    // A 200 with an error field keeps the panel rendering: an expired token is
    // information the user needs to see, not a page that fails to load.
    return NextResponse.json({ configured: true, error: message, data: null });
  }
}
