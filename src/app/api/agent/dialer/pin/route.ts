import { verifyHash } from "@/lib/auth";
import { hookOk, hookUrl, tail10, vobizParams } from "@/lib/dialer/config";
import { memberById } from "@/lib/dialer/members";
import { openSession, roomXml } from "@/lib/dialer/line";
import { esc, speak, xml } from "@/lib/dialer/vobiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TRIES = 3;

/**
 * The passcode the person typed (Gather action). Right: their line opens as a
 * conference room of their own and stays open; every lead they tap in ARC is
 * dialled into it. Wrong: two more tries, then hang up.
 */
export async function POST(req: Request) {
  if (!hookOk(req)) return new Response("forbidden", { status: 403 });
  const url = new URL(req.url);
  const memberId = url.searchParams.get("m") || "";
  const tries = Math.max(1, parseInt(url.searchParams.get("n") || "1", 10) || 1);
  const p = await vobizParams(req);
  const digits = p("Digits").replace(/\D/g, "");
  const callUuid = p("CallUUID");

  const member = await memberById(memberId);
  // The passcode only counts from the person's own registered mobile.
  const ok = Boolean(member?.dialer_pin_hash && digits && tail10(p("From")) === tail10(member.dialer_phone)
    && (await verifyHash(digits, member.dialer_pin_hash!)));

  if (!ok || !member) {
    if (tries >= MAX_TRIES || !member) return xml(speak("That passcode is not right. Goodbye.") + "<Hangup/>");
    return xml(
      `<Gather action="${esc(hookUrl("pin", { m: memberId, n: String(tries + 1) }))}" method="POST" inputType="dtmf" numDigits="6" finishOnKey="#" executionTimeout="20">` +
        speak("That passcode is not right. Try again, then press hash.") +
      `</Gather>` + speak("Goodbye.") + "<Hangup/>",
    );
  }

  if (callUuid) await openSession(member, callUuid);
  return xml(roomXml(member, `Dialer is live, ${member.name.split(" ")[0]}. Open ARC and tap a lead to call. Stay on this line.`));
}

export const GET = POST;
