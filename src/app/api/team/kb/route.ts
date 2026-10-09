import { forbidden, getViewer, tdb, unauthorized } from "@/lib/team";
import { KB_SECTIONS, kbPatch, listKb } from "@/lib/team-kb";

/** The knowledge base: every team login reads it; the owner adds entries. */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getViewer())) return unauthorized();
  try {
    return Response.json({ sections: KB_SECTIONS, entries: await listKb() });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.kind !== "owner") return forbidden("Only the owner edits the knowledge base.");
  const p = kbPatch(await req.json().catch(() => ({})), false);
  if (typeof p === "string") return Response.json({ error: p }, { status: 400 });
  const { data, error } = await tdb.from("team_kb").insert({ ...p, source: "arc" }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ entry: data }, { status: 201 });
}
