import { forbidden, getViewer, tdb, unauthorized } from "@/lib/team";
import { kbPatch } from "@/lib/team-kb";

/** Edit or remove one knowledge-base entry. Owner only. */
export const dynamic = "force-dynamic";
type Ctx = { params: { id: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.kind !== "owner") return forbidden("Only the owner edits the knowledge base.");
  const p = kbPatch(await req.json().catch(() => ({})), true);
  if (typeof p === "string") return Response.json({ error: p }, { status: 400 });
  if (!Object.keys(p).length) return Response.json({ error: "Nothing to change." }, { status: 400 });
  const { data, error } = await tdb.from("team_kb").update(p).eq("id", params.id).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ entry: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.kind !== "owner") return forbidden("Only the owner edits the knowledge base.");
  const { error } = await tdb.from("team_kb").delete().eq("id", params.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
