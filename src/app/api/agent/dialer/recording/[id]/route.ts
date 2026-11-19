import { RECORDINGS_BUCKET } from "@/lib/dialer/process";
import { recordingKeyOk } from "@/lib/dialer/config";
import { db } from "@/lib/dialer/members";
import { getViewer } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * Plays one team-dialer recording. Opens with a signed-in ARC session, or with
 * the per-call key in ?k= (that is the link stored on the PROXe lead, so the
 * PROXe player can follow it). The file itself is never public.
 *
 * Streams the audio straight from storage. It used to redirect to a 10-minute
 * signed link, but Next's fetch cache handed back the SAME signed link long
 * after it expired, so older recordings played as 0:00 (Z, 19 Nov 2026).
 * Range requests pass through so the player can seek.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("not found", { status: 404 });
  const k = new URL(req.url).searchParams.get("k");
  const allowed = recordingKeyOk(id, k) || Boolean(await getViewer().catch(() => null));
  if (!allowed) return new Response("not found", { status: 404 });
  const { data } = await db.from("dialer_calls").select("recording_key").eq("id", id).maybeSingle();
  if (!data?.recording_key) return new Response("recording not saved yet", { status: 404 });

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const path = String(data.recording_key).split("/").map(encodeURIComponent).join("/");
  const range = req.headers.get("range");
  const upstream = await fetch(`${base}/storage/v1/object/${RECORDINGS_BUCKET}/${path}`, {
    headers: { Authorization: `Bearer ${key}`, apikey: key, ...(range ? { Range: range } : {}) },
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) return new Response("recording unavailable", { status: 502 });

  const headers = new Headers({
    "Content-Type": upstream.headers.get("content-type") || "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
  });
  for (const h of ["content-length", "content-range"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
