import { recordOutreachActivity } from "@/lib/outreach-data";
import { getViewer, workerLabel } from "@/lib/team";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  // The owner's updates stay "manual"; a team member's carry their login name.
  const viewer = await getViewer();
  return recordOutreachActivity(await req.json().catch(() => null), workerLabel(viewer));
}
