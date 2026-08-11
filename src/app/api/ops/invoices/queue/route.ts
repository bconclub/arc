import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** GET /api/ops/invoices/queue?status=pending */
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? "pending";
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
  return NextResponse.json({ items: data ?? [] });
}
