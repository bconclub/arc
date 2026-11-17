import { e164, hookOk, hookUrl, tail10, vobizParams } from "@/lib/dialer/config";
import { db, memberById, memberByMobile, membersByCallerId, targetByPhone } from "@/lib/dialer/members";
import { recordSession, speak, xml, esc } from "@/lib/dialer/vobiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Answer URL of the Vobiz application on the team's company numbers: every
 * call INTO one of them lands here.
 *
 * - From a team member's registered mobile: ask for the dialer passcode.
 * - From anyone else (a lead calling back): ring whoever last called them
 *   from that number; if nobody did, ring every caller on that number at
 *   once. Recorded and filed like any other call, answered or not.
 */
export async function POST(req: Request) {
  if (!hookOk(req)) return new Response("forbidden", { status: 403 });
  const p = await vobizParams(req);
  const from = p("From"), to = p("To"), callUuid = p("CallUUID");

  const agent = await memberByMobile(from);
  if (agent) {
    if (!agent.dialer_pin_hash) return xml(speak("Your dialer passcode is not set yet. Ask the owner to set it in ARC.") + "<Hangup/>");
    return xml(
      `<Gather action="${esc(hookUrl("pin", { m: agent.id, n: "1" }))}" method="POST" inputType="dtmf" numDigits="6" finishOnKey="#" executionTimeout="20">` +
        speak("Welcome to the BCON dialer. Enter your passcode, then press hash.") +
      `</Gather>` + speak("No passcode entered. Goodbye.") + "<Hangup/>",
    );
  }

  // A lead calling a company number back: put them through to whoever called
  // them last from it, else the person that number belongs to.
  const { data: last } = await db.from("dialer_calls").select("member_id").eq("direction", "outbound")
    .eq("phone", e164(from) || from).order("started_at", { ascending: false }).limit(1);
  const lastMember = last?.[0]?.member_id ? await memberById(last[0].member_id) : null;
  const mine = lastMember?.dialer_phone && tail10(lastMember.dialer_caller_id) === tail10(to) ? [lastMember] : [];
  const ring = mine.length ? mine : await membersByCallerId(to);
  const target = await targetByPhone(from);
  const { data: row } = await db.from("dialer_calls").insert({
    member_id: ring[0]?.id || lastMember?.id || null, target_id: target?.id || null, proxe_lead_id: target?.proxe_lead_id || null,
    direction: "inbound", phone: e164(from) || from, caller_id: to, call_uuid: callUuid || null,
    status: "connected", answered_at: new Date().toISOString(),
  }).select("id").single();
  if (!ring.length) return xml(speak("Thank you for calling. We will call you back shortly.") + "<Hangup/>");
  const rec = row?.id ? recordSession(hookUrl("rec", { c: row.id })) : "";
  return xml(
    rec +
    `<Dial callerId="${esc(to)}" timeout="25">${ring.map((m) => `<Number>${esc(m.dialer_phone!)}</Number>`).join("")}</Dial>` +
    speak("Sorry, nobody could take your call. We will call you back shortly."),
  );
}

export const GET = POST;
