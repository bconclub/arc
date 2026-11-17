import { hashPassword } from "@/lib/auth";
import { forbidden, getViewer, unauthorized } from "@/lib/team";
import { e164, hookUrl, vobizConfigured } from "@/lib/dialer/config";
import { attachNumber, ensureApplication } from "@/lib/dialer/vobiz";
import { db } from "@/lib/dialer/members";
import { actorFor } from "@/lib/dialer/line";
import { saveGuide } from "@/lib/dialer/guide";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Owner only: a person's dialer setup. Body: { member_id, mobile?, number?, pin? }.
 * mobile = the phone they dial in from; number = their company (Vobiz) number;
 * pin = a new 6-digit passcode (stored hashed, never shown again).
 * Body { member_id, connect: true } instead points their company number's
 * incoming calls at the dialer (Vobiz application with the webhook URLs).
 */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  const b = await req.json().catch(() => null) as { member_id?: string; mobile?: string; number?: string; pin?: string; connect?: boolean; guide?: string[] } | null;
  const owner = viewer.kind === "owner";
  // The call guide (questions to get answered) is the owner's.
  if (Array.isArray(b?.guide)) {
    if (!owner) return forbidden("Only the owner edits the call guide.");
    const { error } = await saveGuide(b.guide.map(String));
    return error ? Response.json({ error: "Could not save the guide." }, { status: 500 }) : Response.json({ ok: true });
  }
  // A team login sets its own mobile and passcode; the owner sets anyone's, and the company number.
  const self = await actorFor(viewer);
  const id = owner && b?.member_id ? String(b.member_id) : self?.id || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Pick a person." }, { status: 400 });
  if (!owner && (b?.number !== undefined || b?.connect)) return forbidden("Only the owner sets the company number.");

  if (b?.connect) {
    if (!vobizConfigured()) return Response.json({ error: "Add the Vobiz keys to ARC first." }, { status: 503 });
    const { data: m } = await db.from("team_members").select("dialer_caller_id").eq("id", id).maybeSingle();
    if (!m?.dialer_caller_id) return Response.json({ error: "Save their company number first." }, { status: 400 });
    try {
      const appId = await ensureApplication(hookUrl("answer"), hookUrl("hangup"));
      await attachNumber(m.dialer_caller_id, appId);
      return Response.json({ ok: true, number: m.dialer_caller_id });
    } catch (e) {
      return Response.json({ error: (e as Error).message.slice(0, 240) }, { status: 502 });
    }
  }

  const patch: Record<string, string | null> = {};
  if (b?.mobile !== undefined) {
    const v = b.mobile.trim() ? e164(b.mobile) : null;
    if (b.mobile.trim() && !v) return Response.json({ error: "Mobile number is not valid." }, { status: 400 });
    patch.dialer_phone = v;
  }
  if (b?.number !== undefined) {
    const v = b.number.trim() ? e164(b.number) : null;
    if (b.number.trim() && !v) return Response.json({ error: "Company number is not valid." }, { status: 400 });
    patch.dialer_caller_id = v;
  }
  if (b?.pin) {
    if (!/^\d{6}$/.test(b.pin)) return Response.json({ error: "Passcode must be 6 digits." }, { status: 400 });
    patch.dialer_pin_hash = await hashPassword(b.pin);
  }
  if (!Object.keys(patch).length) return Response.json({ error: "Nothing to change." }, { status: 400 });

  // A dial-in mobile belongs to one person (it is how a dial-in is recognised).
  // A company number may be shared: a lead calling back reaches whoever called them last.
  const { data: others } = await db.from("team_members").select("id,dialer_phone,dialer_caller_id").neq("id", id);
  const clash = ((others || []) as { dialer_phone: string | null; dialer_caller_id: string | null }[]).some((o) =>
    (patch.dialer_phone && (o.dialer_phone === patch.dialer_phone || o.dialer_caller_id === patch.dialer_phone)) ||
    (patch.dialer_caller_id && o.dialer_phone === patch.dialer_caller_id));
  if (clash) return Response.json({ error: "That number is already set for someone else." }, { status: 409 });

  const { error } = await db.from("team_members").update(patch).eq("id", id);
  if (error) return Response.json({ error: /column/.test(error.message) ? "Run the team dialer migration first." : "Could not save. Retry." }, { status: 500 });
  return Response.json({ ok: true });
}
