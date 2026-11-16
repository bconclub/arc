import { hookOk, hookUrl, vobizParams } from "@/lib/dialer/config";
import { db } from "@/lib/dialer/members";
import { esc, recordSession, speak, xml } from "@/lib/dialer/vobiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Answer URL of a lead leg: the lead picked up the call from the company
 * number. Recording starts first, then the lead joins the person's room.
 * If the person's line has closed meanwhile, the lead is told we will call back.
 */
export async function POST(req: Request) {
  if (!hookOk(req)) return new Response("forbidden", { status: 403 });
  const id = new URL(req.url).searchParams.get("c") || "";
  const p = await vobizParams(req);
  const { data: call } = /^[0-9a-f-]{36}$/i.test(id)
    ? await db.from("dialer_calls").select("id,session_id").eq("id", id).maybeSingle()
    : { data: null };
  if (!call) return xml("<Hangup/>");

  const { data: session } = call.session_id
    ? await db.from("dialer_sessions").select("room,status").eq("id", call.session_id).maybeSingle()
    : { data: null };
  await db.from("dialer_calls").update({
    status: "connected", answered_at: new Date().toISOString(), ...(p("CallUUID") ? { call_uuid: p("CallUUID") } : {}),
  }).eq("id", call.id);

  if (!session || session.status !== "live") {
    return xml(speak("Hello, this is BCON. Sorry, we got cut off. We will call you back shortly.") + "<Hangup/>");
  }
  return xml(
    recordSession(hookUrl("rec", { c: call.id })) +
    `<Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="false">${esc(session.room)}</Conference>`,
  );
}

export const GET = POST;
