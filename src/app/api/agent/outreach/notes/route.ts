import { authError, checkIngestAuth } from "@/lib/ingest-auth";
import { tdb } from "@/lib/team";
import { listNotes, notePatch, notesAsText } from "@/lib/outbound-notes";

/**
 * The shared caller log, for agents (GOD, the GTM agent, PROXe Core, anything that
 * touches an AI caller).
 *
 * GET  -> { notes, text }: read this before changing a caller or the dial flow.
 * POST { notes: [{ external_id, kind, body, caller?, action?, author?, call_id?, noted_on?, resolved? }] }
 *      Upserts by external_id under the calling agent's name (x-agent-name), so a
 *      re-post of the same note never duplicates. Notes typed on the page are never touched.
 *
 * Machine endpoint: exempt from the session gate via the api/agent prefix in
 * middleware.ts, bearer-checked here with ARC_INGEST_SECRET.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = checkIngestAuth(req);
  if (!auth.ok) return authError(auth);
  try {
    const notes = await listNotes();
    return Response.json({ notes, text: notesAsText(notes) });
  } catch {
    return Response.json({ error: "Caller log unavailable" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const auth = checkIngestAuth(req);
  if (!auth.ok) return authError(auth);
  if (!auth.agent || auth.agent === "unknown" || auth.agent === "arc") return Response.json({ error: "x-agent-name required" }, { status: 400 });
  const body = await req.json().catch(() => null);
  const entries = Array.isArray(body?.notes) ? body.notes.slice(0, 200) : [];
  const rows: Record<string, unknown>[] = [];
  const rejected: { external_id: unknown; error: string }[] = [];
  for (const e of entries) {
    const id = typeof e?.external_id === "string" ? e.external_id.trim().slice(0, 200) : "";
    const p = notePatch(e || {}, false);
    if (!id) rejected.push({ external_id: e?.external_id, error: "external_id required" });
    else if (typeof p === "string") rejected.push({ external_id: id, error: p });
    else rows.push({ author: auth.agent, ...p, source: auth.agent, external_id: id });
  }
  if (rows.length) {
    const { error } = await tdb.from("outbound_notes").upsert(rows, { onConflict: "source,external_id" });
    if (error) return Response.json({ error: "Could not save notes" }, { status: 500 });
  }
  return Response.json({ ok: true, upserted: rows.length, rejected });
}
