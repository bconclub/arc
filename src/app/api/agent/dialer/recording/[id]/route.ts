import { r2Presign } from "@/lib/r2";
import { recordingKeyOk } from "@/lib/dialer/config";
import { db } from "@/lib/dialer/members";
import { getViewer } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Plays one team-dialer recording. Opens with a signed-in ARC session, or with
 * the per-call key in ?k= (that is the link stored on the PROXe lead, so the
 * PROXe player can follow it). Redirects to a 10-minute R2 link; the file
 * itself is never public.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("not found", { status: 404 });
  const k = new URL(req.url).searchParams.get("k");
  const allowed = recordingKeyOk(id, k) || Boolean(await getViewer().catch(() => null));
  if (!allowed) return new Response("not found", { status: 404 });
  const { data } = await db.from("dialer_calls").select("recording_key").eq("id", id).maybeSingle();
  if (!data?.recording_key) return new Response("recording not saved yet", { status: 404 });
  return Response.redirect(r2Presign(data.recording_key, { expires: 600 }), 302);
}
