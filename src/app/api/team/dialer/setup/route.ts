import { hashPassword } from "@/lib/auth";
import { forbidden, getViewer, unauthorized } from "@/lib/team";
import { e164 } from "@/lib/dialer/config";
import { db } from "@/lib/dialer/members";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Owner only: a person's dialer setup. Body: { member_id, mobile?, number?, pin? }.
 * mobile = the phone they dial in from; number = their company (Vobiz) number;
 * pin = a new 6-digit passcode (stored hashed, never shown again).
 */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.kind !== "owner") return forbidden("Only the owner sets up the dialer.");
  const b = await req.json().catch(() => null) as { member_id?: string; mobile?: string; number?: string; pin?: string } | null;
  const id = String(b?.member_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Pick a person." }, { status: 400 });

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

  // A mobile or company number belongs to one person only.
  const { data: others } = await db.from("team_members").select("id,dialer_phone,dialer_caller_id").neq("id", id);
  const clash = ((others || []) as { dialer_phone: string | null; dialer_caller_id: string | null }[]).some((o) =>
    (patch.dialer_phone && (o.dialer_phone === patch.dialer_phone || o.dialer_caller_id === patch.dialer_phone)) ||
    (patch.dialer_caller_id && (o.dialer_caller_id === patch.dialer_caller_id || o.dialer_phone === patch.dialer_caller_id)));
  if (clash) return Response.json({ error: "That number is already set for someone else." }, { status: 409 });

  const { error } = await db.from("team_members").update(patch).eq("id", id);
  if (error) return Response.json({ error: /column/.test(error.message) ? "Run the team dialer migration first." : "Could not save. Retry." }, { status: 500 });
  return Response.json({ ok: true });
}
