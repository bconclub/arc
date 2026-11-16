import { supabaseAdmin } from "@/lib/supabase";
import { authError, checkIngestAuth } from "@/lib/ingest-auth";
import { parseBankSms } from "@/lib/bank-sms";

export const dynamic = "force-dynamic";

type InSms = { sender?: string; body?: string; ts?: number };

/**
 * The phone worker posts bank SMS here: { device, messages: [{ sender, body, ts }] }.
 * The phone already drops OTPs and anything that is not a bank transaction; this
 * route parses again and drops whatever still does not read as a credit or debit.
 *
 * Re-sending is safe: rows dedupe on dedupe_key. A new transaction from a
 * counterparty that was tagged before (brand, label, business/personal) is tagged
 * the same way on arrival.
 */
export async function POST(req: Request) {
  const auth = checkIngestAuth(req, { bank: true });
  if (!auth.ok) return authError(auth);

  const body = await req.json().catch(() => null);
  const messages: InSms[] = Array.isArray(body?.messages) ? body.messages.slice(0, 500) : [];
  const device = typeof body?.device === "string" ? body.device.slice(0, 60) : null;

  const parsed = messages
    .map((m) => (m.sender && m.body ? parseBankSms(String(m.sender), String(m.body), Number(m.ts) || 0) : null))
    .filter((t): t is NonNullable<typeof t> => !!t);

  // Learn from earlier tags on the same counterparty.
  const names = Array.from(new Set(parsed.map((t) => t.counterparty?.toLowerCase()).filter(Boolean))) as string[];
  const tags = new Map<string, { status: string; label: string | null; brand_id: string | null }>();
  if (names.length) {
    const { data } = await supabaseAdmin
      .from("bank_txns")
      .select("counterparty, status, label, brand_id, txn_at")
      .in("status", ["business", "personal", "ignored", "matched"])
      .order("txn_at", { ascending: false })
      .limit(2000);
    for (const r of (data ?? []) as { counterparty: string | null; status: string; label: string | null; brand_id: string | null }[]) {
      const k = r.counterparty?.toLowerCase();
      if (!k || !names.includes(k) || tags.has(k)) continue;
      tags.set(k, { status: r.status === "matched" ? "business" : r.status, label: r.label, brand_id: r.brand_id });
    }
  }

  const rows = parsed.map((t) => {
    const tag = t.counterparty ? tags.get(t.counterparty.toLowerCase()) : undefined;
    return { ...t, device, ...(tag ? { status: tag.status, label: tag.label, brand_id: tag.brand_id } : {}) };
  });

  let inserted = 0;
  if (rows.length) {
    const { data, error } = await supabaseAdmin
      .from("bank_txns")
      .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
      .select("id");
    if (error) return Response.json({ error: error.message }, { status: 500 });
    inserted = data?.length ?? 0;
  }

  return Response.json({ received: messages.length, parsed: parsed.length, inserted });
}
