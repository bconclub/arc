import { getViewer, unauthorized } from "@/lib/team";
import { db } from "@/lib/dialer/members";
import { liveCheck, liveLines } from "@/lib/dialer/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What is being said on my call right now, and which questions it has answered. */
export async function GET(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  const id = new URL(req.url).searchParams.get("c") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Call not found." }, { status: 404 });
  const { data: call } = await db.from("dialer_calls").select("id,member_id").eq("id", id).maybeSingle();
  if (!call || (viewer.kind === "team" && call.member_id !== viewer.member.id)) return Response.json({ error: "Call not found." }, { status: 404 });
  const [lines, check] = await Promise.all([liveLines(id), liveCheck(id)]);
  return Response.json({ lines, covered: check?.covered || {}, score: check?.score || null });
}
