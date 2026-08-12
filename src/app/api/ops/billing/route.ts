import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * The billing vault: every invoice and quote ever issued.
 *
 * Separate from /api/ops/payments, which is the working set that drives
 * receivables. This is the history, and every row carries settlement 'unknown'
 * until somebody confirms it.
 */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("billing_documents")
    .select("*")
    .order("issued_on", { ascending: false, nullsFirst: false });
  if (error) {
    // The table arrives with 20260813010000_billing_vault.sql. An empty vault
    // with a note beats a broken page when the migration has not run.
    if (/billing_documents/.test(error.message)) return NextResponse.json([]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
