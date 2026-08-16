import type { ParsedInvoice } from "../parse";

/**
 * Deterministic extraction for BCON's own invoice templates.
 *
 * These documents come from a closed set of layouts, so rules beat a model on
 * them: they are free, instant, testable, and cannot hallucinate a figure.
 * The quirks encoded here were all found while reconciling the billing vault:
 *
 * - the 2021 template writes "Already Paid" where the later one writes "Paid"
 * - some templates carry a bare "Total" where others say "Net Total", and
 *   "Total Due" is the payable figure, not the work value
 * - IG3's template labels its 18% as TAX rather than GST
 * - where due exceeds net by exactly 18% and no advance explains it, the
 *   arithmetic states the tax even when no label does
 *
 * Returns null when it cannot find a total — that is "not my template",
 * and the caller moves down the ladder rather than accepting a guess.
 */

const BCON_GSTIN = "29AQOPA1017H1Z3";

/** Indian-grouped amount: 1,23,456.00 — also plain 123456 or 1234.50 */
const AMOUNT_RE = /(?:₹|rs\.?|inr)?\s*([0-9][\d,]*(?:\.\d{1,2})?)\b/i;

const GSTIN_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z0-9]{2}\b/g;

function toNumber(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Last amount on a line — labels sit left, figures right on every template. */
function amountOn(line: string): number | null {
  const matches = Array.from(line.matchAll(new RegExp(AMOUNT_RE.source, "gi")));
  if (!matches.length) return null;
  const raw = matches[matches.length - 1][1];
  const n = toNumber(raw);
  // A bare "18" on a GST line is the rate, not the amount.
  if (n !== null && n <= 100 && /%|@|rate/i.test(line)) return null;
  return n;
}

function findLine(lines: string[], label: RegExp, exclude?: RegExp): { line: string; i: number } | null {
  for (let i = 0; i < lines.length; i++) {
    if (label.test(lines[i]) && !(exclude && exclude.test(lines[i]))) return { line: lines[i], i };
  }
  return null;
}

function findAmount(lines: string[], label: RegExp, exclude?: RegExp): number | null {
  const hit = findLine(lines, label, exclude);
  if (!hit) return null;
  // Figure on the label's own line, else the next non-empty line (stacked layouts).
  const own = amountOn(hit.line);
  if (own !== null) return own;
  for (let j = hit.i + 1; j < Math.min(hit.i + 3, lines.length); j++) {
    if (!lines[j].trim()) continue;
    return amountOn(lines[j]);
  }
  return null;
}

/** Day-first date anywhere in the line → YYYY-MM-DD. */
function dateOn(line: string): string | null {
  const numeric = line.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (numeric) {
    const [, d, m, y] = numeric;
    const year = y.length === 2 ? `20${y}` : y;
    const mm = m.padStart(2, "0");
    const dd = d.padStart(2, "0");
    if (Number(mm) >= 1 && Number(mm) <= 12) return `${year}-${mm}-${dd}`;
  }
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const named = line.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/);
  if (named) {
    const idx = MONTHS.indexOf(named[2].slice(0, 3).toLowerCase());
    if (idx >= 0) return `${named[3]}-${String(idx + 1).padStart(2, "0")}-${named[1].padStart(2, "0")}`;
  }
  return null;
}

function findDate(lines: string[], label: RegExp): string | null {
  const hit = findLine(lines, label);
  if (!hit) return null;
  const own = dateOn(hit.line);
  if (own) return own;
  for (let j = hit.i + 1; j < Math.min(hit.i + 3, lines.length); j++) {
    const d = dateOn(lines[j]);
    if (d) return d;
  }
  return null;
}

const OWN_NAMES = /bcon|thanzeel|ashruf/i;

function findClient(lines: string[]): string | null {
  const hit = findLine(lines, /\b(?:bill(?:ed)?\s*to|invoice\s*to|customer|client)\b/i);
  if (!hit) return null;
  // The party may be on the same line after the label, or on the lines below.
  const inline = hit.line.replace(/.*\b(?:bill(?:ed)?\s*to|invoice\s*to|customer|client)\b[:\s]*/i, "").trim();
  if (inline && !OWN_NAMES.test(inline)) return inline;
  for (let j = hit.i + 1; j < Math.min(hit.i + 4, lines.length); j++) {
    const candidate = lines[j].trim();
    if (!candidate) continue;
    if (OWN_NAMES.test(candidate)) continue;
    // An address or GSTIN line is not a name.
    if (GSTIN_RE.test(candidate) || /^\d/.test(candidate)) continue;
    return candidate;
  }
  return null;
}

export function extractFromText(text: string): ParsedInvoice | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  // ── the payable figure ──
  const totalDue =
    findAmount(lines, /\b(?:balance\s*due|amount\s*(?:payable|due)|total\s*due|grand\s*total)\b/i) ??
    // bare "Total" only when it isn't "Net Total"/"Sub Total" — on templates
    // carrying both, bare Total is the gross payable
    findAmount(lines, /\btotal\b/i, /\b(?:net|sub)\s*total\b/i);
  if (totalDue === null) return null;

  // ── work value ──
  const subtotal =
    findAmount(lines, /\b(?:net\s*total|sub\s*total|taxable\s*(?:value|amount))\b/i);

  // ── tax: GST under any of its names, TAX included (the IG3 quirk) ──
  const cgst = findAmount(lines, /\bcgst\b/i);
  const sgst = findAmount(lines, /\bsgst\b/i);
  // "TAX INVOICE" is a title, not a tax line, and GSTIN lines carry the word GST.
  let tax =
    findAmount(lines, /\b(?:igst|gst|tax)\b/i, /\bgstin\b|tax\s*invoice/i) ??
    (cgst !== null && sgst !== null ? cgst + sgst : null);

  // ── money already taken off ("Already Paid" 2021 vs "Paid" later) ──
  const advance = findAmount(
    lines,
    /\b(?:already\s*paid|advance(?:\s*paid)?|amount\s*paid)\b/i,
  );

  // Where the gap between net and due is exactly 18% and no advance explains
  // it, the arithmetic states the tax even when the label does not.
  if (tax === null && subtotal !== null && advance === null) {
    const gap = totalDue - subtotal;
    if (gap > 0 && Math.abs(gap - subtotal * 0.18) <= 1) tax = Math.round(gap * 100) / 100;
  }

  // ── identity ──
  // Every "invoice" line is tried, not just the first: templates open with a
  // bare "INVOICE" title and put the number on a later line.
  let invoice_no: string | null = null;
  for (const line of lines) {
    if (!/\b(?:invoice|inv)\b/i.test(line)) continue;
    const m =
      line.match(/\b(BCON[\s-]?\d{2,5})\b/i) ??
      line.match(/(?:no\.?|number|#)[:\s]*([A-Z0-9][A-Z0-9/-]{2,15})/i) ??
      line.match(/\binvoice\b[^\d]{0,10}(\d{4,10})\b/i);
    if (m) { invoice_no = m[1].replace(/\s+/g, ""); break; }
  }
  if (!invoice_no) {
    const anywhere = text.match(/\b(BCON[\s-]?\d{2,5})\b/i);
    if (anywhere) invoice_no = anywhere[1].replace(/\s+/g, "");
  }

  const issued_on = findDate(lines, /\b(?:invoice\s*date|dated?)\b/i);
  const due_on = findDate(lines, /\b(?:due\s*date|payment\s*due|pay\s*by)\b/i);

  const client = findClient(lines);

  const gstins = Array.from(text.matchAll(GSTIN_RE), (m) => m[0]).filter((g) => g !== BCON_GSTIN);
  const gstin = gstins[0] ?? null;

  const currency = /₹|\brs\.?\b|\binr\b/i.test(text) ? "INR"
    : /\$|\busd\b/i.test(text) ? "USD"
    : /£|\bgbp\b/i.test(text) ? "GBP"
    : null;

  // ── confidence, from arithmetic rather than optimism ──
  const reconciles =
    subtotal !== null &&
    Math.abs(subtotal + (tax ?? 0) - (advance ?? 0) - totalDue) <= 1;
  const confidence: ParsedInvoice["confidence"] =
    reconciles && invoice_no ? "high"
    : invoice_no || issued_on ? "medium"
    : "low";

  const notes: string[] = [];
  if (advance !== null) notes.push(`Advance of ${advance} already deducted on the document.`);
  if (subtotal !== null && !reconciles) notes.push("Figures do not reconcile; returned as printed.");

  return {
    invoice_no,
    issued_on,
    due_on,
    client,
    description: null,
    currency,
    subtotal,
    tax_amount: tax,
    total_amount: totalDue,
    gstin,
    confidence,
    notes: notes.length ? notes.join(" ") : null,
  };
}
