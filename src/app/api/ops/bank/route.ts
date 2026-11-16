import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Bank transactions for a month (?month=YYYY-MM, default current), plus the open
 * receivables a credit can be matched against.
 */
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "bad month" }, { status: 400 });
  const [y, m] = month.split("-").map(Number);
  // IST month bounds.
  const from = new Date(Date.UTC(y, m - 1, 1) - 330 * 60000).toISOString();
  const to = new Date(Date.UTC(y, m, 1) - 330 * 60000).toISOString();

  const [txns, open] = await Promise.all([
    supabaseAdmin.from("bank_txns").select("*").gte("txn_at", from).lt("txn_at", to).order("txn_at", { ascending: false }),
    supabaseAdmin
      .from("payments")
      .select("id, client, item, amount, status, due, invoice_no")
      .in("status", ["pending", "invoiced", "overdue"])
      .order("due", { ascending: true, nullsFirst: false }),
  ]);
  if (txns.error) return NextResponse.json({ error: txns.error.message }, { status: 500 });
  return NextResponse.json({ month, txns: txns.data ?? [], open: open.data ?? [] });
}
