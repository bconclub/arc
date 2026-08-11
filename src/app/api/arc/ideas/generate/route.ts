// Manual trigger for the idea engine, the ARC Agent page "Generate Top Ideas"
// button hits this. Regenerates the proposed-ideas list from the current feed.
import { regenerateProposedIdeas } from "@/lib/arc/ideas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const count = await regenerateProposedIdeas(8);
    return Response.json({ ok: true, generated: count });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generate-ideas error:", msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
