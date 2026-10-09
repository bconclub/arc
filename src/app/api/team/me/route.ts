import { getViewer, listMembers, unauthorized } from "@/lib/team";

/** Who is signed in, and the active team (for assignment pickers). */
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  const members = (await listMembers()).map((m) => ({ id: m.id, name: m.name }));
  return Response.json({
    role: viewer.kind,
    me: viewer.kind === "team" ? { id: viewer.member.id, name: viewer.member.name, username: viewer.member.username } : null,
    members,
  });
}
