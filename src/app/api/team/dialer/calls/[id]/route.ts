import { getViewer, unauthorized } from "@/lib/team";
import { db } from "@/lib/dialer/members";
import { processCall } from "@/lib/dialer/process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function load(id: string) {
  const viewer = await getViewer();
  if (!viewer) return { error: unauthorized() };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: Response.json({ error: "Call not found." }, { status: 404 }) };
  const { data: call } = await db.from("dialer_calls").select("*").eq("id", id).maybeSingle();
  if (!call || (viewer.kind === "team" && call.member_id !== viewer.member.id)) return { error: Response.json({ error: "Call not found." }, { status: 404 }) };
  return { call };
}

/** One call: status, the note, the details picked up, the transcript. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const r = await load(params.id);
  if (r.error) return r.error;
  const c = r.call;
  let transcript: unknown[] = [];
  try { transcript = c.transcript ? JSON.parse(c.transcript) : []; } catch { /* plain text */ }
  return Response.json({
    call: {
      id: c.id, status: c.status, direction: c.direction, phone: c.phone, target_id: c.target_id,
      started_at: c.started_at, answered_at: c.answered_at, ended_at: c.ended_at, duration_secs: c.duration_secs,
      hangup_cause: c.hangup_cause, outcome: c.outcome, note: c.note, fields: c.fields,
      recording_status: c.recording_status, has_recording: Boolean(c.recording_key),
      processed_at: c.processed_at, proxe_synced_at: c.proxe_synced_at, proxe_error: c.proxe_error, error: c.error,
      transcript,
    },
  });
}

/** File it now (retry after an error). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const r = await load(params.id);
  if (r.error) return r.error;
  try {
    await processCall(params.id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
