import { getViewer, unauthorized } from "@/lib/team";
import { db } from "@/lib/dialer/members";
import { hangup } from "@/lib/dialer/vobiz";
import { failPending } from "@/lib/dialer/line";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** End the lead's side of a call (the person's line stays open). Body: { id }. */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  const body = await req.json().catch(() => null) as { id?: string } | null;
  const id = String(body?.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Which call?" }, { status: 400 });
  const { data: call } = await db.from("dialer_calls").select("id,member_id,session_id,call_uuid,request_uuid,status").eq("id", id).maybeSingle();
  if (!call || (viewer.kind === "team" && call.member_id !== viewer.member.id)) return Response.json({ error: "Call not found." }, { status: 404 });
  if (!["dialing", "connected"].includes(call.status)) return Response.json({ ok: true, already: true });
  // Still waiting for the person's own phone to pick up: drop it.
  if (!call.session_id && call.member_id) {
    await failPending(call.member_id, "Cancelled.");
    return Response.json({ ok: true });
  }
  const done = await hangup(call.call_uuid, call.request_uuid);
  return Response.json({ ok: done });
}
