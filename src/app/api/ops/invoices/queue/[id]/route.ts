import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Ctx = { params: { id: string } };

type Parsed = {
  invoice_no?: string | null;
  issued_on?: string | null;
  due_on?: string | null;
  client?: string | null;
  description?: string | null;
  total_amount?: number | null;
};

/**
 * PATCH /api/ops/invoices/queue/{id}
 *   { action: "reject" }
 *   { action: "accept", paymentId?: string, client?: string }
 *
 * Accepting writes the parsed figures onto an existing payment row, or creates
 * one when there is nothing to attach to. Rejecting keeps the row so the same
 * attachment is never proposed again; deleting it would put the invoice straight
 * back in the queue on the next scan.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = body.action;

  const { data: item, error: readErr } = await supabaseAdmin
    .from("email_ingest").select("*").eq("id", id).single();
  if (readErr || !item) {
    return NextResponse.json({ error: readErr?.message ?? "Not found" }, { status: 404 });
  }

  if (action === "reject") {
    const { error } = await supabaseAdmin
      .from("email_ingest")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  if (action !== "accept") {
    return NextResponse.json({ error: 'action must be "accept" or "reject"' }, { status: 400 });
  }

  const parsed = (item.parsed ?? {}) as Parsed;
  if (parsed.total_amount == null) {
    // Accepting a reading with no total would write nothing useful and mark the
    // attachment handled, hiding it from view for good.
    return NextResponse.json(
      { error: "That reading has no total, so there is nothing to accept. Reject it or enter the amount by hand." },
      { status: 400 },
    );
  }

  // The client name on the row wins over the one read off the document: it is
  // what the rollups match on, and the person accepting may have corrected it.
  const client = body.client ?? parsed.client ?? null;

  let paymentId: string | null = body.paymentId ?? null;

  if (paymentId) {
    const patch: Record<string, unknown> = { amount: parsed.total_amount };
    if (parsed.due_on) patch.due = parsed.due_on;
    if (parsed.description) patch.item = parsed.description;
    const { error } = await supabaseAdmin.from("payments").update(patch).eq("id", paymentId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .insert({
        client,
        item: parsed.description ?? (parsed.invoice_no ? `Invoice ${parsed.invoice_no}` : null),
        amount: parsed.total_amount,
        due: parsed.due_on ?? null,
        // Read off a sent invoice, so it has been issued but not yet paid.
        status: "invoiced",
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    paymentId = data.id;
  }

  const { error } = await supabaseAdmin
    .from("email_ingest")
    .update({ status: "accepted", payment_id: paymentId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: "accepted", paymentId });
}
