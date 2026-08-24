import { NextRequest, NextResponse } from "next/server";
import { fetchMetaAds, adAccountsByBrand } from "@/lib/ads/meta";

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
  // `brand` picks one of the accounts in META_AD_ACCOUNTS; without it the panel
  // shows whichever account is listed first (or the legacy single account).
  const accounts = adAccountsByBrand();
  const brand = req.nextUrl.searchParams.get("brand");
  const accountId = brand ? accounts[brand] : Object.values(accounts)[0];

  const configured = !!(process.env.META_ACCESS_TOKEN && accountId);
  if (!configured) {
    const missing = [
      !process.env.META_ACCESS_TOKEN && "META_ACCESS_TOKEN",
      !accountId && (brand ? `an account for brand "${brand}"` : "META_AD_ACCOUNTS or META_AD_ACCOUNT_ID"),
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
    return NextResponse.json({
      configured: true,
      error: null,
      brands: Object.keys(accounts),
      data: await fetchMetaAds(range, accountId),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not reach Meta.";
    // A 200 with an error field keeps the panel rendering: an expired token is
    // information the user needs to see, not a page that fails to load.
    return NextResponse.json({ configured: true, error: message, data: null });
  }
}
