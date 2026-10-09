import { forbidden, getViewer, tdb, unauthorized } from "@/lib/team";

/** Move a task along (members: their own, status only). The owner edits or deletes any. */
export const dynamic = "force-dynamic";
type Ctx = { params: { id: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  const b = await req.json().catch(() => ({}));
  const { data: task } = await tdb.from("team_tasks").select("id,member_id").eq("id", params.id).maybeSingle();
  if (!task) return Response.json({ error: "Task not found." }, { status: 404 });
  if (viewer.kind === "team" && task.member_id !== viewer.member.id) return forbidden();

  const patch: Record<string, unknown> = {};
  if (["todo", "doing", "done"].includes(b.status)) {
    patch.status = b.status;
    patch.done_at = b.status === "done" ? new Date().toISOString() : null;
  }
  if (viewer.kind === "owner") {
    if (typeof b.title === "string" && b.title.trim()) patch.title = b.title.trim().slice(0, 200);
    if (typeof b.details === "string") patch.details = b.details.trim().slice(0, 4000) || null;
    if ("due_on" in b) patch.due_on = /^\d{4}-\d{2}-\d{2}$/.test(String(b.due_on || "")) ? b.due_on : null;
  }
  if (!Object.keys(patch).length) return Response.json({ error: "Nothing to change." }, { status: 400 });
  const { data, error } = await tdb.from("team_tasks").update(patch).eq("id", params.id).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ task: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const viewer = await getViewer();
  if (viewer?.kind !== "owner") return forbidden("Only the owner removes tasks.");
  const { error } = await tdb.from("team_tasks").delete().eq("id", params.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
