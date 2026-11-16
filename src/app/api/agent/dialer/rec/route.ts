import { hookOk, vobizParams } from "@/lib/dialer/config";
import { db } from "@/lib/dialer/members";
import { processCall } from "@/lib/dialer/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Record callbackUrl. Vobiz posts here when a call's recording is ready
 * (Event=RecordStop with RecordUrl/RecordFile + RecordingID). We keep the
 * pointer, then file the call: copy to the private bucket, transcribe, note, PROXe.
 */
export async function POST(req: Request) {
  if (!hookOk(req)) return new Response("forbidden", { status: 403 });
  const id = new URL(req.url).searchParams.get("c") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ ok: true });
  const p = await vobizParams(req);
  const url = p("RecordUrl") || p("RecordFile") || p("RecordingUrl");
  const recId = p("RecordingID") || p("RecordingId");
  if (recId || url) {
    await db.from("dialer_calls").update({
      ...(recId ? { recording_id: recId } : {}),
      ...(url ? { recording_src: url } : {}),
    }).eq("id", id).is("recording_key", null);
  }
  // Only the final event (with the file) files the call; the start event just carries the id.
  if (url) {
    // The hang-up may arrive after this; mark the call ended if it still looks live.
    const secs = parseInt(p("RecordingDuration") || "0", 10) || 0;
    await db.from("dialer_calls").update({ status: "ended", ended_at: new Date().toISOString(), duration_secs: secs })
      .eq("id", id).in("status", ["dialing", "connected"]);
    await processCall(id).catch((e) => console.error("[dialer] rec", (e as Error).message));
  }
  return Response.json({ ok: true });
}

export const GET = POST;
