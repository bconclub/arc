import { forbidden, getViewer, tdb, unauthorized } from "@/lib/team";

/**
 * Hand a batch of unassigned open leads to a member (owner only): newest
 * inbound first, or outbound prospects oldest first. Returns how many moved.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return unauthorized();
  if (viewer.kind !== "owner") return forbidden();
  const b = await req.json().catch(() => ({}));
  const memberId = String(b.member_id || "");
  const count = Math.max(1, Math.min(200, Math.round(Number(b.count) || 0)));
  const from = b.from === "outbound" ? "outbound" : "inbound";
  if (!/^[0-9a-f-]{36}$/i.test(memberId)) return Response.json({ error: "Pick a team member." }, { status: 400 });

  let q = tdb.from("outreach_targets").select("id").eq("kind", "business").is("owner_id", null).not("status", "in", "(won,lost)");
  q = from === "inbound"
    ? q.eq("source", "proxe_inbound").order("created_at", { ascending: false })
    : q.or("source.is.null,source.neq.proxe_inbound").not("phone", "is", null).order("created_at", { ascending: true });
  const { data, error } = await q.limit(count);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const ids = (data || []).map((r: { id: string }) => r.id);
  if (!ids.length) return Response.json({ assigned: 0 });
  const { error: e2 } = await tdb.from("outreach_targets").update({ owner_id: memberId }).in("id", ids);
  if (e2) return Response.json({ error: e2.message }, { status: 500 });
  return Response.json({ assigned: ids.length });
}
