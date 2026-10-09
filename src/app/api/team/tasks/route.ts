import { forbidden, getViewer, tdb, unauthorized } from "@/lib/team";

/**
 * Tasks the owner gives team members. A member reads only their own; the owner
 * reads everyone's (or one person's with ?member=) and creates them.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  let q = tdb.from("team_tasks").select("*").order("due_on", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  if (viewer.kind === "team") q = q.eq("member_id", viewer.member.id);
  else {
    const m = new URL(req.url).searchParams.get("member");
    if (m) q = q.eq("member_id", m);
  }
  const { data, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ tasks: data });
}

export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.kind !== "owner") return forbidden("Only the owner assigns tasks.");
  const b = await req.json().catch(() => ({}));
  const title = String(b.title || "").trim().slice(0, 200);
  if (!title || !/^[0-9a-f-]{36}$/i.test(String(b.member_id || ""))) return Response.json({ error: "A task needs a person and a title." }, { status: 400 });
  const row = {
    member_id: b.member_id, title,
    details: String(b.details || "").trim().slice(0, 4000) || null,
    due_on: /^\d{4}-\d{2}-\d{2}$/.test(String(b.due_on || "")) ? b.due_on : null,
    target_id: /^[0-9a-f-]{36}$/i.test(String(b.target_id || "")) ? b.target_id : null,
  };
  const { data, error } = await tdb.from("team_tasks").insert(row).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ task: data }, { status: 201 });
}
