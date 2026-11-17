import { getViewer, unauthorized } from "@/lib/team";
import { e164, vobizConfigured } from "@/lib/dialer/config";
import { db, liveSession, targetByPhone } from "@/lib/dialer/members";
import { actorFor, dialLead, failPending, ringAgent } from "@/lib/dialer/line";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tap a lead (or type a number): the lead is rung from the person's company
 * number and joins their line. Body: { target_id } or { phone }.
 *
 * Line already open (they dialled in, or are between calls): the lead is rung
 * at once. No line: the person's own phone rings first; when they pick up, the
 * lead is rung. Either way the lead only ever sees the company number.
 */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (!vobizConfigured()) return Response.json({ error: "The dialer is not connected to Vobiz yet." }, { status: 503 });
  const actor = await actorFor(viewer);
  if (!actor) return Response.json({ error: "Dialer is not set up for this login." }, { status: 409 });

  const body = await req.json().catch(() => null) as { target_id?: string; phone?: string } | null;
  const from = e164(actor.dialer_caller_id);
  if (!from) return Response.json({ error: "You have no company number yet. Ask the owner to set it." }, { status: 409 });

  let target: { id: string; phone: string | null; proxe_lead_id: string | null } | null = null;
  let to: string | null = null;
  if (body?.target_id) {
    if (!/^[0-9a-f-]{36}$/i.test(body.target_id)) return Response.json({ error: "Pick a lead." }, { status: 400 });
    const { data } = await db.from("outreach_targets").select("id,phone,proxe_lead_id").eq("id", body.target_id).maybeSingle();
    if (!data) return Response.json({ error: "Lead not found." }, { status: 404 });
    target = data;
    to = e164(data.phone);
  } else if (body?.phone) {
    to = e164(body.phone);
    const hit = to ? await targetByPhone(to) : null;
    target = hit ? { id: hit.id, phone: to, proxe_lead_id: hit.proxe_lead_id } : null;
  }
  if (!to) return Response.json({ error: "That is not a valid phone number." }, { status: 400 });

  // One lead at a time.
  const { data: busy } = await db.from("dialer_calls").select("id").eq("member_id", actor.id).in("status", ["dialing", "connected"])
    .gt("started_at", new Date(Date.now() - 2 * 3600e3).toISOString()).limit(1);
  if (busy?.length) return Response.json({ error: "You are already on a call. End it first." }, { status: 409 });

  const session = await liveSession(actor.id);
  if (!session && !e164(actor.dialer_phone)) {
    return Response.json({ error: "Add your mobile number on the Dialer page first, so the dialer can ring you." }, { status: 409 });
  }

  const { data: row, error } = await db.from("dialer_calls").insert({
    member_id: actor.id, session_id: session?.id || null, target_id: target?.id || null, proxe_lead_id: target?.proxe_lead_id || null,
    direction: "outbound", phone: to, caller_id: from, status: "dialing",
  }).select("id").single();
  if (error || !row) return Response.json({ error: "Could not start the call. Retry." }, { status: 500 });

  if (session) {
    const res = await dialLead(row.id, from, to);
    if (!res.ok) return Response.json({ error: "Vobiz could not place the call. " + res.error.slice(0, 160) }, { status: 502 });
    return Response.json({ ok: true, id: row.id });
  }
  try {
    await ringAgent(actor); // the lead is dialled when they pick up (api/agent/dialer/agent)
    return Response.json({ ok: true, id: row.id, ringing_you: true });
  } catch (e) {
    await failPending(actor.id, (e as Error).message.slice(0, 300));
    return Response.json({ error: "Could not ring your phone. " + (e as Error).message.slice(0, 160) }, { status: 502 });
  }
}
