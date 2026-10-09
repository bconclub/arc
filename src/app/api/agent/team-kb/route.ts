import { authError, checkIngestAuth } from "@/lib/ingest-auth";
import { tdb } from "@/lib/team";
import { kbPatch } from "@/lib/team-kb";

/**
 * PROXe pushes sales knowledge here (product changes, new links, pricing, FAQs)
 * so the team's knowledge base stays current without anyone retyping it.
 *
 * POST { entries: [{ external_id, section, title, body?, url?, when_to_share?, tags?, position? }],
 *        remove?: [external_id, ...] }
 * Upserts by external_id (source 'proxe'); `remove` deletes PROXe entries that
 * no longer exist. Entries the owner wrote in ARC are never touched.
 *
 * Machine endpoint: exempt from the session gate via the api/agent prefix in
 * middleware.ts, bearer-checked here with ARC_INGEST_SECRET.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = checkIngestAuth(req);
  if (!auth.ok) return authError(auth);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "bad json" }, { status: 400 });

  const entries = Array.isArray(body.entries) ? body.entries.slice(0, 500) : [];
  const rows: Record<string, unknown>[] = [];
  const rejected: { external_id: unknown; error: string }[] = [];
  for (const e of entries) {
    const id = typeof e?.external_id === "string" ? e.external_id.trim().slice(0, 200) : "";
    const p = kbPatch(e || {}, false);
    if (!id) rejected.push({ external_id: e?.external_id, error: "external_id required" });
    else if (typeof p === "string") rejected.push({ external_id: id, error: p });
    else rows.push({ ...p, source: "proxe", external_id: id });
  }
  if (rows.length) {
    const { error } = await tdb.from("team_kb").upsert(rows, { onConflict: "source,external_id" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  let removed = 0;
  const remove = Array.isArray(body.remove) ? body.remove.filter((x: unknown) => typeof x === "string").slice(0, 500) : [];
  if (remove.length) {
    const { data, error } = await tdb.from("team_kb").delete().eq("source", "proxe").in("external_id", remove).select("id");
    if (error) return Response.json({ error: error.message }, { status: 500 });
    removed = (data || []).length;
  }
  return Response.json({ ok: true, upserted: rows.length, removed, rejected });
}
