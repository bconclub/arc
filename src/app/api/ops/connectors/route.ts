import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { CONNECTORS, statusOf, toServiceStatus } from "@/lib/connectors";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * GET , presence check only (fast, no outbound calls).
 * GET ?probe=1, also runs each connector's live reachability check and syncs
 * the result into `services`, so Operations Health reflects reality instead of
 * hand-maintained rows.
 *
 * Only booleans and human-readable detail strings are returned; secret values
 * never leave the server.
 */
export async function GET(req: NextRequest) {
  const probe = req.nextUrl.searchParams.get("probe") === "1";

  const statuses = await Promise.all(CONNECTORS.map((def) => statusOf(def, probe)));

  if (probe) {
    // Best-effort sync, a failure here must not break the panel.
    try {
      const now = new Date().toISOString();
      await Promise.all(
        statuses.map((s) =>
          supabaseAdmin.from("system_health").upsert(
            {
              name: s.name,
              category: s.category,
              status: toServiceStatus(s),
              detail: s.detail,
              last_checked: now,
              updated_at: now,
            },
            { onConflict: "name" }
          )
        )
      );
    } catch {
      // ignore, the connector statuses below are still valid
    }
  }

  return NextResponse.json({
    probed: probe,
    checkedAt: new Date().toISOString(),
    connectors: statuses,
  });
}
