import { getViewer, unauthorized } from "@/lib/team";
import { syncInboundLeads } from "@/lib/team-inbound";

/** "Check PROXe now": pull inbound leads regardless of when we last did. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  if (!(await getViewer())) return unauthorized();
  try {
    return Response.json(await syncInboundLeads());
  } catch (e) {
    return Response.json({ error: `PROXe sync failed: ${(e as Error).message}` }, { status: 502 });
  }
}
