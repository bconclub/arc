import { hashPassword } from "@/lib/auth";
import { forbidden, getViewer, tdb, unauthorized } from "@/lib/team";

/** Rename, switch off/on, or set a new password for a member. Owner only. */
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.kind !== "owner") return forbidden();
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.trim().slice(0, 80);
  if (typeof b.active === "boolean") patch.active = b.active;
  if (typeof b.password === "string") {
    if (b.password.length < 8) return Response.json({ error: "Password: at least 8 characters." }, { status: 400 });
    patch.password_hash = await hashPassword(b.password);
  }
  if (!Object.keys(patch).length) return Response.json({ error: "Nothing to change." }, { status: 400 });
  const { data, error } = await tdb.from("team_members").update(patch).eq("id", params.id)
    .select("id,name,username,role,active,last_login_at,created_at").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ member: data });
}
