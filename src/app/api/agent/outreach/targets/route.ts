import { checkIngestAuth, authError } from "@/lib/ingest-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const KINDS = ["business", "investor", "grant", "citation"];
const STATUSES = [
  "identified",
  "researched",
  "drafted",
  "sent",
  "replied",
  "meeting",
  "won",
  "lost",
  "no_reply",
];

/**
 * GET /api/agent/outreach/targets
 *
 * Bearer-authenticated read endpoint for scheduled jobs (e.g., BDR morning leads).
 * Returns the same filtered outreach_targets view as GET /api/outreach, but uses
 * ARC_INGEST_SECRET instead of arc_session cookie.
 *
 * Query params:
 *   - kind: filter by target kind (business|investor|grant|citation)
 *   - status: filter by status (identified|researched|drafted|sent|replied|meeting|won|lost|no_reply)
 *
 * Auth: Bearer $ARC_INGEST_SECRET
 *
 * Usage example (BDR morning):
 *   curl -H "Authorization: Bearer $ARC_INGEST_SECRET" \
 *        "https://arc.bcon.club/api/agent/outreach/targets?status=identified"
 */
export async function GET(req: Request) {
  const auth = checkIngestAuth(req);
  if (!auth.ok) return authError(auth);

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const status = url.searchParams.get("status");

  let q = supabaseAdmin
    .from("outreach_targets")
    .select("*")
    .order("created_at", { ascending: false });

  if (kind && KINDS.includes(kind)) q = q.eq("kind", kind);
  if (status && STATUSES.includes(status)) q = q.eq("status", status);

  const { data, error } = await q;

  if (error)
    return Response.json({ error: error.message }, { status: 500 });

  return Response.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
