import { getViewer, unauthorized } from "@/lib/team";
import { fetchPipeline } from "@/lib/team-proxe";

/** PROXe's live pipeline (customers, trials, prospects) for the Playbook's Pipeline page. */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getViewer())) return unauthorized();
  try {
    return Response.json(await fetchPipeline());
  } catch (e) {
    return Response.json({ error: `Couldn't read the pipeline from PROXe: ${(e as Error).message}` }, { status: 502 });
  }
}
