import { readOutreachWorkspace } from "@/lib/outreach-data";
import { getViewer, unauthorized } from "@/lib/team";
import { lastInboundSync, syncInboundLeads } from "@/lib/team-inbound";

/**
 * The sales view's lead list: business targets only (outbound prospects and
 * inbound PROXe leads), with their activity. Pulls new inbound leads from PROXe
 * first when the last pull is over five minutes old.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  let syncError: string | null = null;
  try {
    const r = await syncInboundLeads({ ifStale: true });
    if (r.skipped && r.skipped !== "fresh") syncError = r.skipped;
  } catch (e) {
    syncError = `Could not pull new inbound leads from PROXe: ${(e as Error).message}`;
  }
  try {
    const ws = await readOutreachWorkspace();
    const targets = ws.targets.filter((t) => t.kind === "business");
    const ids = new Set(targets.map((t) => t.id));
    return Response.json({
      targets,
      activity: ws.activity.filter((a) => ids.has(a.target_id)),
      reportingReady: ws.reportingReady,
      inbound_synced_at: await lastInboundSync(),
      sync_error: syncError,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Leads could not load. Please retry." }, { status: 503 });
  }
}
