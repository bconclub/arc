import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { listMail, gmailConfigured, type MailSummary } from "@/lib/gmail";
import { brandForEmail, brandForText } from "@/lib/brand-match";
import { brandKeys } from "@/lib/rollup";
import type { Brand } from "@/types/ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
// One Gmail round trip per message, so a wide scan is slow rather than costly.
export const maxDuration = 120;

/**
 * POST /api/ops/mail/sync — client mail, as ops signals.
 *
 * The invoice scan already reads mail, but only for attachments it can parse:
 * a client asking where something is, or confirming a date, leaves no trace in
 * ARC at all. This puts the header line of that conversation on the brand's
 * timeline — subject, sender, snippet — and stops there.
 *
 * Not a mail client. Nothing is downloaded, nothing is parsed, and the body is
 * never stored; the signal carries a link back to Gmail, which is where mail is
 * actually read.
 */

/** Gmail rejects very long queries, and a wide OR is slow. */
const MAX_BRANDS_IN_QUERY = 12;
const MAX_MESSAGES = 25;
const HARD_MAX = 50;
/** Snippets run long; the timeline shows one line. */
const SNIPPET_CHARS = 240;

type Counts = {
  configured: boolean;
  scanned: number;
  matched: number;
  inserted: number;
  skippedInvoice: number;
  skippedDup: number;
  error: string | null;
};

/** Gmail search terms that identify one brand: its registered domains, then its
 *  names. Domains first because a name is a guess and a domain is not. */
function brandTerms(brand: Brand): string[] {
  const terms: string[] = [];
  for (const d of brand.domains ?? []) {
    const clean = String(d).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();
    if (clean) terms.push(clean);
  }
  // Quoted, so a two-word brand is not searched as two separate words — that
  // pulls in half the mailbox.
  for (const key of brandKeys(brand)) {
    if (key.length >= 4) terms.push(`"${key.replace(/"/g, "")}"`);
  }
  return terms;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { brand?: string; max?: number };

  if (!gmailConfigured()) {
    // Same shape as the invoice scan, so one client-side check covers both.
    return NextResponse.json({
      configured: false,
      detail: "Not connected. Missing GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET or GMAIL_REFRESH_TOKEN.",
      scanned: 0, matched: 0, inserted: 0, skippedInvoice: 0, skippedDup: 0, error: null,
    } satisfies Counts & { detail: string });
  }

  const max = Math.min(HARD_MAX, Math.max(1, Number(body.max) || MAX_MESSAGES));

  const { data: brandRows, error: brandErr } = await supabaseAdmin.from("brands").select("*");
  if (brandErr) {
    return NextResponse.json(
      { configured: true, scanned: 0, matched: 0, inserted: 0, skippedInvoice: 0, skippedDup: 0, error: brandErr.message },
      { status: 500 },
    );
  }
  const brands = (brandRows ?? []) as Brand[];

  // A brand filter narrows to one register row; without one, every brand that
  // has something searchable about it, capped so the query stays sane.
  const wanted = body.brand
    ? brands.filter((b) => brandKeys(b).includes(String(body.brand).trim().toLowerCase()))
    : brands.filter((b) => (b.domains?.length ?? 0) > 0 || (b.aliases?.length ?? 0) > 0).slice(0, MAX_BRANDS_IN_QUERY);

  if (wanted.length === 0) {
    return NextResponse.json({
      configured: true, scanned: 0, matched: 0, inserted: 0, skippedInvoice: 0, skippedDup: 0,
      error: body.brand ? `No brand named "${body.brand}".` : "No brands have a domain or alias to search on.",
    } satisfies Counts);
  }

  const terms = wanted.flatMap(brandTerms);
  if (terms.length === 0) {
    return NextResponse.json({
      configured: true, scanned: 0, matched: 0, inserted: 0, skippedInvoice: 0, skippedDup: 0,
      error: `Nothing to search on: ${wanted.map((b) => b.name).join(", ")} has no domain or alias.`,
    } satisfies Counts);
  }
  // Inbox and sent both: a thread is only legible with both halves of it.
  const q = `(in:inbox OR in:sent) (${terms.join(" OR ")})`;

  let messages: MailSummary[];
  try {
    messages = await listMail(q, max);
  } catch (e) {
    return NextResponse.json(
      {
        configured: true, scanned: 0, matched: 0, inserted: 0, skippedInvoice: 0, skippedDup: 0,
        error: e instanceof Error ? e.message : "Gmail search failed.",
      } satisfies Counts,
      { status: 502 },
    );
  }

  const allowed = body.brand ? new Set(wanted.map((b) => b.id)) : null;

  // Attribute before hitting the database, so the lookups below only cover
  // messages that are actually going to be considered.
  const candidates: { msg: MailSummary; brand: Brand }[] = [];
  for (const msg of messages) {
    const brand =
      brandForEmail(msg.from, brands) ??
      brandForEmail(msg.to, brands) ??
      brandForText(`${msg.subject} ${msg.from} ${msg.to} ${msg.snippet}`, brands);
    if (!brand) continue;
    // A brand-scoped run must not file another brand's mail: the Gmail query is
    // a text search and will happily match a passing mention.
    if (allowed && !allowed.has(brand.id)) continue;
    candidates.push({ msg, brand });
  }

  const ids = candidates.map((c) => c.msg.id);
  const [invoiceIds, seenUrls] = await Promise.all([
    invoiceMessageIds(ids),
    existingSignalUrls(ids.map(gmailUrl)),
  ]);

  const rows: Record<string, unknown>[] = [];
  let skippedInvoice = 0;
  let skippedDup = 0;

  for (const { msg, brand } of candidates) {
    // The invoice pipeline owns anything it has already ingested. Filing it
    // again here would put the same mail on the timeline twice, once as a
    // parsed invoice and once as a subject line.
    if (invoiceIds.has(msg.id)) { skippedInvoice += 1; continue; }
    const url = gmailUrl(msg.id);
    if (seenUrls.has(url)) { skippedDup += 1; continue; }
    // Two copies of the same message inside one batch, which the database
    // lookup above cannot catch because neither is written yet.
    seenUrls.add(url);

    const snippet = msg.snippet.length > SNIPPET_CHARS ? `${msg.snippet.slice(0, SNIPPET_CHARS)}…` : msg.snippet;
    rows.push({
      source: "gmail",
      title: msg.subject || "(no subject)",
      detail: [`From: ${msg.from || "unknown"}`, snippet].filter(Boolean).join(" | "),
      severity: "info",
      url,
      brand_id: brand.id,
      seen: false,
      ts: msg.date ?? new Date().toISOString(),
    });
  }

  let inserted = 0;
  let error: string | null = null;
  if (rows.length > 0) {
    let { error: insertErr } = await supabaseAdmin.from("ops_signals").insert(rows);
    // Until 20260815000000 runs, ops_signals has no brand_id. An unattributed
    // signal still beats losing the whole run over the stamp.
    if (insertErr && /brand_id/.test(insertErr.message)) {
      const stripped = rows.map((r) => {
        const copy = { ...r };
        delete copy.brand_id;
        return copy;
      });
      ({ error: insertErr } = await supabaseAdmin.from("ops_signals").insert(stripped));
    }
    if (insertErr) error = insertErr.message;
    else inserted = rows.length;
  }

  return NextResponse.json({
    configured: true,
    scanned: messages.length,
    matched: candidates.length,
    inserted,
    skippedInvoice,
    skippedDup,
    error,
  } satisfies Counts);
}

/** Opens the message in Gmail. Doubles as the idempotency key: the message id
 *  is in there, so a re-run recognises what it already filed. */
function gmailUrl(messageId: string): string {
  return `https://mail.google.com/mail/u/0/#all/${messageId}`;
}

/** Message ids the invoice pipeline has already taken. */
async function invoiceMessageIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await supabaseAdmin
    .from("email_ingest").select("message_id").in("message_id", ids);
  // The table arrives with 20260812120000_email_ingest.sql. Missing means
  // nothing has been ingested, which is exactly an empty set.
  if (error) return new Set();
  return new Set((data ?? []).map((r) => String(r.message_id)));
}

async function existingSignalUrls(urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();
  const { data, error } = await supabaseAdmin
    .from("ops_signals").select("url").eq("source", "gmail").in("url", urls);
  if (error) return new Set();
  return new Set((data ?? []).map((r) => String(r.url)));
}
