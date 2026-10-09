import { hashPassword } from "@/lib/auth";
import { forbidden, getViewer, listMembers, tdb, unauthorized } from "@/lib/team";

/**
 * The owner's Team page: every member with what they're carrying (leads owned,
 * open tasks, updates logged in 7 days), and adding a member. Owner only.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.kind !== "owner") return forbidden();
  const members = await listMembers(true);
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const [leads, tasks, acts] = await Promise.all([
    tdb.from("outreach_targets").select("owner_id,status").not("owner_id", "is", null),
    tdb.from("team_tasks").select("member_id,status"),
    tdb.from("outreach_activity").select("worker,channel").gte("occurred_at", since),
  ]);
  type L = { owner_id: string; status: string };
  type T = { member_id: string; status: string };
  type A = { worker: string; channel: string };
  const stats = members.map((m) => {
    const mine = ((leads.data || []) as L[]).filter((l) => l.owner_id === m.id);
    const t = ((tasks.data || []) as T[]).filter((x) => x.member_id === m.id);
    const a = ((acts.data || []) as A[]).filter((x) => x.worker === m.username);
    return {
      ...m,
      leads: mine.length,
      leads_open: mine.filter((l) => !["won", "lost"].includes(l.status)).length,
      tasks_open: t.filter((x) => x.status !== "done").length,
      updates_7d: a.length,
      calls_7d: a.filter((x) => x.channel === "call").length,
    };
  });
  return Response.json({ members: stats });
}

export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.kind !== "owner") return forbidden();
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim().slice(0, 80);
  const username = String(b.username || "").trim().toLowerCase();
  const password = String(b.password || "");
  if (!name) return Response.json({ error: "Add their name." }, { status: 400 });
  if (!/^[a-z0-9.]{2,32}$/.test(username)) return Response.json({ error: "Login name: 2 to 32 letters, digits or dots." }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "Password: at least 8 characters." }, { status: 400 });
  const { data, error } = await tdb.from("team_members")
    .insert({ name, username, password_hash: await hashPassword(password), role: "sales" })
    .select("id,name,username,role,active,last_login_at,created_at").single();
  if (error) {
    const taken = error.code === "23505";
    return Response.json({ error: taken ? "That login name is taken." : error.message }, { status: taken ? 409 : 500 });
  }
  return Response.json({ member: data }, { status: 201 });
}
