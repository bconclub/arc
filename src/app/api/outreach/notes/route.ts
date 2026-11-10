import { getViewer, tdb, unauthorized, forbidden } from "@/lib/team";
import { listNotes, notePatch } from "@/lib/outbound-notes";

// The caller log for people signed in to ARC. Anyone signed in reads it; the owner
// adds notes, marks problems fixed and removes mistakes.
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer().catch(() => null);
  if (!viewer) return unauthorized();
  try {
    return Response.json({ notes: await listNotes(), canEdit: viewer.kind === "owner" });
  } catch {
    return Response.json({ error: "Caller log unavailable. Try again shortly." }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const viewer = await getViewer().catch(() => null);
  if (!viewer) return unauthorized();
  if (viewer.kind !== "owner") return forbidden();
  const b = await req.json().catch(() => null);
  const p = notePatch(b || {}, false);
  if (typeof p === "string") return Response.json({ error: p }, { status: 400 });
  const { data, error } = await tdb.from("outbound_notes").insert({ author: "Z", ...p, source: "arc" }).select("*").single();
  if (error) return Response.json({ error: "Could not save the note." }, { status: 500 });
  return Response.json({ note: data });
}

export async function PATCH(req: Request) {
  const viewer = await getViewer().catch(() => null);
  if (!viewer) return unauthorized();
  if (viewer.kind !== "owner") return forbidden();
  const b = await req.json().catch(() => null);
  const id = String(b?.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Note not found." }, { status: 404 });
  const p = notePatch(b || {}, true);
  if (typeof p === "string") return Response.json({ error: p }, { status: 400 });
  const { data, error } = await tdb.from("outbound_notes").update(p).eq("id", id).select("*").single();
  if (error || !data) return Response.json({ error: "Could not update the note." }, { status: 500 });
  return Response.json({ note: data });
}

export async function DELETE(req: Request) {
  const viewer = await getViewer().catch(() => null);
  if (!viewer) return unauthorized();
  if (viewer.kind !== "owner") return forbidden();
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Note not found." }, { status: 404 });
  const { error } = await tdb.from("outbound_notes").delete().eq("id", id);
  if (error) return Response.json({ error: "Could not remove the note." }, { status: 500 });
  return Response.json({ ok: true });
}
