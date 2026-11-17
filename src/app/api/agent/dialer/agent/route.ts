import { hookOk, vobizParams } from "@/lib/dialer/config";
import { memberById } from "@/lib/dialer/members";
import { dialPending, openSession, roomXml } from "@/lib/dialer/line";
import { speak, xml } from "@/lib/dialer/vobiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Answer URL of the leg that rings a person's own phone (they tapped a lead in
 * ARC with no line open). Picking up opens their line, no passcode: the call
 * was started from their signed-in ARC session. The lead that was waiting is
 * dialled at once.
 */
export async function POST(req: Request) {
  if (!hookOk(req)) return new Response("forbidden", { status: 403 });
  const member = await memberById(new URL(req.url).searchParams.get("m") || "");
  const p = await vobizParams(req);
  const callUuid = p("CallUUID");
  if (!member || !callUuid) return xml(speak("Sorry, the dialer could not open your line.") + "<Hangup/>");
  const sessionId = await openSession(member, callUuid);
  if (sessionId) await dialPending(member, sessionId).catch((e) => console.error("[dialer] pending", (e as Error).message));
  return xml(roomXml(member, "Dialer is live. Calling your lead now. Stay on this line between calls."));
}

export const GET = POST;
