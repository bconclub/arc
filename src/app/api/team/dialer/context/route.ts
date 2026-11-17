import { getViewer, unauthorized } from "@/lib/team";
import { e164 } from "@/lib/dialer/config";
import { db, targetByPhone } from "@/lib/dialer/members";
import { proxeLeadByPhone } from "@/lib/dialer/proxe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET_COLS = "id,name,org,segment,city,phone,email,website,why_them,research,notes,status,source,next_at,inbound,qualification_note";

/**
 * What we know about the person being called, for the dialer screen:
 * the lead itself, the last few things logged on it, and what earlier dialer
 * calls picked up. ?target_id= or ?phone=.
 */
export async function GET(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  const q = new URL(req.url).searchParams;
  const phone = e164(q.get("phone"));
  let id = q.get("target_id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) id = phone ? (await targetByPhone(phone))?.id || "" : "";

  const { data: target } = id ? await db.from("outreach_targets").select(TARGET_COLS).eq("id", id).maybeSingle() : { data: null };
  const { data: activity } = id
    ? await db.from("outreach_activity").select("channel,outcome,worker,occurred_at,summary").eq("target_id", id).order("occurred_at", { ascending: false }).limit(5)
    : { data: [] };
  const num = e164(target?.phone) || phone;
  let cq = db.from("dialer_calls").select("id,started_at,duration_secs,outcome,note,fields,checklist,recording_key")
    .not("processed_at", "is", null).order("started_at", { ascending: false }).limit(5);
  cq = id ? cq.eq("target_id", id) : cq.eq("phone", num || "none");
  const { data: calls } = await cq;

  // Everything earlier calls picked up, newest answer per field.
  const known: Record<string, string> = {};
  for (const c of ((calls || []) as { fields: Record<string, string> | null }[]).slice().reverse()) {
    for (const [k, v] of Object.entries(c.fields || {})) if (v) known[k] = v;
  }
  const proxe = await proxeLeadByPhone(num).catch(() => null);
  return Response.json({
    target: target || null,
    proxe,
    known,
    activity: ((activity || []) as { summary: string }[]).map((a) => ({ ...a, summary: String(a.summary || "").split("\nTRANSCRIPT:")[0].slice(0, 500) })),
    calls: ((calls || []) as { id: string; recording_key: string | null; fields: unknown }[]).map(({ recording_key, fields, ...c }) => {
      void fields;
      return { ...c, has_recording: Boolean(recording_key) };
    }),
  });
}
