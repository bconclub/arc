import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** GET /api/ops/invoices/queue?status=pending&brand=Name */
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const brand = (req.nextUrl.searchParams.get("brand") ?? "").trim();
  let q = supabaseAdmin
    .from("email_ingest")
    .select("*")
    .order("sent_at", { ascending: false, nullsFirst: false });

  if (status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) {
    // The table arrives with 20260812120000_email_ingest.sql. Reporting an empty
    // queue with a note beats a broken panel when the migration has not run.
    if (/email_ingest/.test(error.message)) {
      return NextResponse.json({ items: [], detail: "Run the email_ingest migration to enable the review queue." });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  let items = data ?? [];

  // Scoped to one brand, the list has to be about that brand. It was showing
  // every unparsed attachment in the mailbox on every brand page, so an
  // ElevenLabs receipt sat under Felicia Products as though it were theirs.
  if (brand) {
    const needle = brand.toLowerCase();

    // A row the scan attributed by domain or alias is scoped by that id —
    // definitive either way. Only unattributed rows fall through to the
    // word-matching heuristic.
    const { data: brandRow } = await supabaseAdmin
      .from("brands").select("id,name,aliases").ilike("name", brand).maybeSingle();

    const words = needle.split(/\s+/).filter((w) => w.length > 3);
    items = items.filter((row) => {
      if (brandRow && row.brand_id) return row.brand_id === brandRow.id;
      const parsed = (row.parsed ?? {}) as Record<string, unknown>;
      const billed = String(parsed.billed_to ?? parsed.client ?? "").toLowerCase();
      if (billed && (billed.includes(needle) || needle.includes(billed))) return true;
      // Fall back to the mail itself, but only on a distinctive word, so a
      // brand called "The Tech Jobs" does not match every mail saying "tech".
      const hay = `${row.subject ?? ""} ${row.from_address ?? ""} ${row.filename ?? ""}`.toLowerCase();
      return words.length > 0 && words.every((w) => hay.includes(w));
    });
  }

  return NextResponse.json({ items });
}
