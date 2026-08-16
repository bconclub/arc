import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { brandForText } from "@/lib/brand-match";
import type { Brand } from "@/types/ops";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Ctx = { params: { id: string } };

type Parsed = {
  invoice_no?: string | null;
  issued_on?: string | null;
  due_on?: string | null;
  client?: string | null;
  description?: string | null;
  subtotal?: number | null;
  tax_amount?: number | null;
  total_amount?: number | null;
  gstin?: string | null;
  currency?: string | null;
};

/**
 * Fields present in the schema only after the 20260815/20260816 migrations.
 * A write that fails on one of these columns retries without them — the core
 * figures must land even on a database the migrations have not reached.
 */
const EXTENDED = ["invoice_no", "invoice_date", "gstin", "tax_amount", "taxable_value", "brand_id", "source"] as const;

async function writePayment(
  table: "update" | "insert",
  full: Record<string, unknown>,
  id?: string,
): Promise<{ id: string | null; error: string | null }> {
  const attempt = async (row: Record<string, unknown>) =>
    table === "update"
      ? supabaseAdmin.from("payments").update(row).eq("id", id!).select("id").single()
      : supabaseAdmin.from("payments").insert(row).select("id").single();

  let { data, error } = await attempt(full);
  if (error && /column|schema/i.test(error.message)) {
    const basic = { ...full };
    for (const k of EXTENDED) delete basic[k];
    ({ data, error } = await attempt(basic));
  }
  return { id: data?.id ?? null, error: error?.message ?? null };
}

/**
 * PATCH /api/ops/invoices/queue/{id}
 *   { action: "reject" }
 *   { action: "accept", paymentId?: string, client?: string }
 *
 * Accepting writes the parsed figures onto an existing payment row, or creates
 * one when there is nothing to attach to. The whole reading is persisted —
 * invoice number, dates, GSTIN and the tax split used to be parsed, stored in
 * email_ingest, and then dropped on the floor at this exact step. Rejecting
 * keeps the row so the same attachment is never proposed again.
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

  // Attribution: the id the scan stamped, else the client name against the registry.
  let brandId: string | null = (item.brand_id as string | null) ?? null;
  if (!brandId && client) {
    const { data: brandRows } = await supabaseAdmin.from("brands").select("*");
    brandId = brandForText(client, (brandRows ?? []) as Brand[])?.id ?? null;
  }

  // Everything the parser read, not just the headline figure.
  const figures: Record<string, unknown> = {
    amount: parsed.total_amount,
    invoice_no: parsed.invoice_no ?? null,
    invoice_date: parsed.issued_on ?? null,
    gstin: parsed.gstin ?? null,
    tax_amount: parsed.tax_amount ?? null,
    taxable_value: parsed.subtotal ?? null,
    brand_id: brandId,
    source: "email",
  };
  if (parsed.due_on) figures.due = parsed.due_on;
  if (parsed.description) figures.item = parsed.description;

  let paymentId: string | null = body.paymentId ?? null;

  if (paymentId) {
    const { error } = await writePayment("update", figures, paymentId);
    if (error) return NextResponse.json({ error }, { status: 500 });
  } else {
    const { id: newId, error } = await writePayment("insert", {
      ...figures,
      client,
      item: figures.item ?? (parsed.invoice_no ? `Invoice ${parsed.invoice_no}` : null),
      // Read off a sent invoice, so it has been issued but not yet paid.
      status: "invoiced",
    });
    if (error) return NextResponse.json({ error }, { status: 500 });
    paymentId = newId;
  }

  const { error } = await supabaseAdmin
    .from("email_ingest")
    .update({ status: "accepted", payment_id: paymentId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // One durable history row. Best-effort: the table arrives with 20260816000000,
  // and a missing history table must not undo an accept that already happened.
  await supabaseAdmin.from("ops_events").insert({
    kind: "invoice_accept",
    summary: `Accepted invoice ${parsed.invoice_no ?? item.filename ?? ""} for ${client ?? "unknown client"} — ₹${parsed.total_amount}`,
    brand_id: brandId,
    refs: [{ table: "payments", id: paymentId }, { table: "email_ingest", id }],
    payload: { parsed },
    source: "api",
  });

  return NextResponse.json({ ok: true, status: "accepted", paymentId });
}
