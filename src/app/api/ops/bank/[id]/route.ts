import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "matched", "business", "personal", "ignored"];

/**
 * Tag a bank transaction: business / personal / ignored, a label, a brand, or
 * match a credit to an open receivable. Matching marks that receivable paid on
 * the day the money landed, with the bank reference kept on it.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof b.status === "string" && STATUSES.includes(b.status)) patch.status = b.status;
  if (typeof b.label === "string" || b.label === null) patch.label = b.label ? String(b.label).slice(0, 120) : null;
  if (typeof b.brand_id === "string" || b.brand_id === null) patch.brand_id = b.brand_id || null;

  if (typeof b.payment_id === "string" || b.payment_id === null) {
    const { data: txn, error } = await supabaseAdmin.from("bank_txns").select("*").eq("id", params.id).single();
    if (error || !txn) return NextResponse.json({ error: "not found" }, { status: 404 });
    const t = txn as { payment_id: string | null; txn_at: string; amount: number; ref: string | null; bank: string | null; direction: string };

    if (b.payment_id) {
      if (t.direction !== "credit") return NextResponse.json({ error: "only credits settle invoices" }, { status: 400 });
      const day = new Date(new Date(t.txn_at).getTime() + 330 * 60000).toISOString().slice(0, 10);
      const { error: pe } = await supabaseAdmin
        .from("payments")
        .update({ status: "paid", paid_at: day, received_on: day, net_received: t.amount, reconciled: true })
        .eq("id", b.payment_id);
      if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });
      patch.payment_id = b.payment_id;
      patch.status = "matched";
    } else if (t.payment_id) {
      // Unmatching puts the receivable back to pending; it was only paid because of this credit.
      await supabaseAdmin.from("payments").update({ status: "pending", paid_at: null, received_on: null, net_received: null, reconciled: false }).eq("id", t.payment_id);
      patch.payment_id = null;
      patch.status = "new";
    }
  }

  if (!Object.keys(patch).length) return NextResponse.json({ error: "nothing to change" }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("bank_txns").update(patch).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
