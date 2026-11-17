import { liveKeyOk } from "@/lib/dialer/config";
import { db } from "@/lib/dialer/members";
import { takePiece } from "@/lib/dialer/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * A few seconds of one voice from a live call, posted by the dialer-stream
 * relay as raw 16-bit 8 kHz audio. Transcribed and kept for the caller's
 * screen. Only accepted with that call's own key, and only while it is on.
 */
export async function POST(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get("c") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !liveKeyOk(id, q.get("k"))) return new Response("forbidden", { status: 403 });
  const { data: call } = await db.from("dialer_calls").select("id,status,ended_at").eq("id", id).maybeSingle();
  const recent = call?.ended_at && Date.now() - Date.parse(call.ended_at) < 60_000; // the last piece lands just after hang-up
  if (!call || !(["dialing", "connected"].includes(call.status) || recent)) return new Response("call is not live", { status: 409 });
  const pcm = Buffer.from(await req.arrayBuffer());
  if (pcm.length > 400_000) return new Response("too large", { status: 413 });
  try {
    const text = await takePiece(id, q.get("track") === "inbound" ? "inbound" : "outbound", Number(q.get("seq")) || 0, pcm);
    return Response.json({ ok: true, heard: text.length });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 120) }, { status: 502 });
  }
}
