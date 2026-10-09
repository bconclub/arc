import { PLAYBOOK_KEY, forbidden, getPlaybook, getViewer, tdb, unauthorized } from "@/lib/team";

/** The team playbook: onboarding reading, and what the assistant answers from. The owner edits it. */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getViewer())) return unauthorized();
  return Response.json(await getPlaybook());
}

export async function PUT(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.kind !== "owner") return forbidden("Only the owner edits the playbook.");
  const b = await req.json().catch(() => ({}));
  if (typeof b.text !== "string" || b.text.length > 60000) return Response.json({ error: "Playbook text up to 60,000 characters." }, { status: 400 });
  const now = new Date().toISOString();
  const { error } = await tdb.from("arc_context").upsert({ key: PLAYBOOK_KEY, value: b.text, updated_at: now });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, updated_at: now });
}
