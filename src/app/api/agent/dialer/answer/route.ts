import { hookOk, hookUrl, vobizParams } from "@/lib/dialer/config";
import { db, memberByCallerId, memberByMobile, targetByPhone } from "@/lib/dialer/members";
import { recordSession, speak, xml, esc } from "@/lib/dialer/vobiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Answer URL of the Vobiz application on the team's company numbers: every
 * call INTO one of them lands here.
 *
 * - From a team member's registered mobile: ask for the dialer passcode.
 * - From anyone else (a lead calling back): ring the person whose company
 *   number they called, recorded, and file it like any other call.
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

  // A lead calling a company number back: put them through to that person.
  const owner = await memberByCallerId(to);
  if (!owner?.dialer_phone) return xml(speak("Thank you for calling BCON. We will call you back shortly.") + "<Hangup/>");
  const target = await targetByPhone(from);
  const { data: row } = await db.from("dialer_calls").insert({
    member_id: owner.id, target_id: target?.id || null, proxe_lead_id: target?.proxe_lead_id || null,
    direction: "inbound", phone: from, caller_id: to, call_uuid: callUuid || null,
    status: "connected", answered_at: new Date().toISOString(),
  }).select("id").single();
  const rec = row?.id ? recordSession(hookUrl("rec", { c: row.id })) : "";
  return xml(
    rec +
    `<Dial callerId="${esc(to)}" timeout="30"><Number>${esc(owner.dialer_phone)}</Number></Dial>` +
    speak("Sorry, nobody could take your call. We will call you back shortly."),
  );
}

export const GET = POST;
