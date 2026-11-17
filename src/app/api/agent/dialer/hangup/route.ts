import { hookOk, vobizParams } from "@/lib/dialer/config";
import { db } from "@/lib/dialer/members";
import { processCall } from "@/lib/dialer/process";
import { failPending } from "@/lib/dialer/line";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Hangup URL of the Vobiz application on the company numbers (and the room's
 * callback). A person's dial-in line ending closes their session; a lead's
 * call-back ending is filed. Conference events without a hang-up are ignored.
 */
export async function POST(req: Request) {
  if (!hookOk(req)) return new Response("forbidden", { status: 403 });
  const p = await vobizParams(req);
  const callUuid = p("CallUUID");
  const isHangup = /hangup/i.test(p("Event")) || Boolean(p("HangupCause")) || /completed|hangup/i.test(p("CallStatus"));
  if (!callUuid || !isHangup) return Response.json({ ok: true });

  // The leg that rang a person's own phone ended: anything still waiting on it did not happen.
  const m = new URL(req.url).searchParams.get("m") || "";
  if (/^[0-9a-f-]{36}$/i.test(m)) await failPending(m, "Your phone did not pick up.");

  const now = new Date().toISOString();
  await db.from("dialer_sessions").update({ status: "ended", ended_at: now }).eq("agent_call_uuid", callUuid).eq("status", "live");

  const { data: call } = await db.from("dialer_calls").select("id,status").eq("call_uuid", callUuid).maybeSingle();
  if (call && ["dialing", "connected"].includes(call.status)) {
    const secs = parseInt(p("BillDuration") || p("Duration") || "0", 10) || 0;
    await db.from("dialer_calls").update({
      status: secs > 0 ? "ended" : "no_answer", ended_at: now, duration_secs: secs, hangup_cause: p("HangupCause") || null,
    }).eq("id", call.id);
    if (secs === 0) await processCall(call.id).catch((e) => console.error("[dialer] hangup", (e as Error).message));
  }
  return Response.json({ ok: true });
}

export const GET = POST;
