import { getViewer, unauthorized } from "@/lib/team";
import { vobizConfigured } from "@/lib/dialer/config";
import { liveSession } from "@/lib/dialer/members";
import { actorFor, closeLine, ringAgent } from "@/lib/dialer/line";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Open the signed-in person's line (rings their own phone) or close it. Body: { action: "open" | "close" }. */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  const actor = await actorFor(viewer);
  if (!actor) return Response.json({ error: "Dialer is not set up for this login." }, { status: 409 });
  const b = await req.json().catch(() => null) as { action?: string } | null;
  if (b?.action === "close") {
    await closeLine(actor.id);
    return Response.json({ ok: true });
  }
  if (!vobizConfigured()) return Response.json({ error: "The dialer is not connected to Vobiz yet." }, { status: 503 });
  if (await liveSession(actor.id)) return Response.json({ ok: true, already: true });
  try {
    await ringAgent(actor);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
