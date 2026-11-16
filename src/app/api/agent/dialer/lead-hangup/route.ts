import { hookOk, vobizParams } from "@/lib/dialer/config";
import { db } from "@/lib/dialer/members";
import { processCall } from "@/lib/dialer/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Hangup URL of a lead leg. Unanswered calls are filed at once; answered ones
 * wait for the recording (rec), which files them.
 */
export async function POST(req: Request) {
  if (!hookOk(req)) return new Response("forbidden", { status: 403 });
  const id = new URL(req.url).searchParams.get("c") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ ok: true });
  const p = await vobizParams(req);
  const { data: call } = await db.from("dialer_calls").select("id,status,answered_at").eq("id", id).maybeSingle();
  if (!call || !["dialing", "connected"].includes(call.status)) return Response.json({ ok: true });

  const secs = parseInt(p("BillDuration") || p("Duration") || "0", 10) || 0;
  const answered = Boolean(call.answered_at) && secs > 0;
  await db.from("dialer_calls").update({
    status: answered ? "ended" : "no_answer",
    ended_at: new Date().toISOString(),
    duration_secs: secs,
    hangup_cause: p("HangupCause") || null,
    ...(p("CallUUID") ? { call_uuid: p("CallUUID") } : {}),
  }).eq("id", id);
  if (!answered) await processCall(id).catch((e) => console.error("[dialer] lead-hangup", (e as Error).message));
  return Response.json({ ok: true });
}

export const GET = POST;
