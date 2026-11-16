import { forbidden, getViewer, unauthorized } from "@/lib/team";
import { e164, hookUrl, vobizConfigured } from "@/lib/dialer/config";
import { db, liveSession } from "@/lib/dialer/members";
import { makeCall } from "@/lib/dialer/vobiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tap a lead: Vobiz rings the lead from the person's company number, and when
 * they pick up they join the person's open line. Body: { target_id }.
 * Needs the person dialled in (their line open).
 */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.kind !== "team") return forbidden("Calls are made from a team login with a company number.");
  if (!vobizConfigured()) return Response.json({ error: "The dialer is not connected to Vobiz yet." }, { status: 503 });

  const body = await req.json().catch(() => null) as { target_id?: string } | null;
  const targetId = String(body?.target_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(targetId)) return Response.json({ error: "Pick a lead." }, { status: 400 });

  const m = viewer.member;
  const { data: me } = await db.from("team_members").select("dialer_caller_id").eq("id", m.id).maybeSingle();
  const from = e164(me?.dialer_caller_id);
  if (!from) return Response.json({ error: "You have no company number yet. Ask the owner to set it." }, { status: 409 });

  const session = await liveSession(m.id);
  if (!session) return Response.json({ error: "Your line is not open. Call your company number and enter your passcode first.", needs_dial_in: true }, { status: 409 });

  const { data: target } = await db.from("outreach_targets").select("id,name,phone,proxe_lead_id").eq("id", targetId).maybeSingle();
  if (!target) return Response.json({ error: "Lead not found." }, { status: 404 });
  const to = e164(target.phone);
  if (!to) return Response.json({ error: "This lead has no valid phone number." }, { status: 400 });

  // One lead at a time on a line.
  const { data: busy } = await db.from("dialer_calls").select("id").eq("session_id", session.id).in("status", ["dialing", "connected"])
    .gt("started_at", new Date(Date.now() - 2 * 3600e3).toISOString()).limit(1);
  if (busy?.length) return Response.json({ error: "You are already on a call. End it first." }, { status: 409 });

  const { data: row, error } = await db.from("dialer_calls").insert({
    member_id: m.id, session_id: session.id, target_id: target.id, proxe_lead_id: target.proxe_lead_id || null,
    direction: "outbound", phone: to, caller_id: from, status: "dialing",
  }).select("id").single();
  if (error || !row) return Response.json({ error: "Could not start the call. Retry." }, { status: 500 });

  try {
    const res = await makeCall({
      from, to,
      answerUrl: hookUrl("lead", { c: row.id }),
      hangupUrl: hookUrl("lead-hangup", { c: row.id }),
    });
    await db.from("dialer_calls").update({ request_uuid: res?.request_uuid || null }).eq("id", row.id);
    return Response.json({ ok: true, id: row.id });
  } catch (e) {
    await db.from("dialer_calls").update({ status: "failed", ended_at: new Date().toISOString(), error: (e as Error).message.slice(0, 500), recording_status: "none", processed_at: new Date().toISOString() }).eq("id", row.id);
    return Response.json({ error: "Vobiz could not place the call. " + (e as Error).message.slice(0, 160) }, { status: 502 });
  }
}
