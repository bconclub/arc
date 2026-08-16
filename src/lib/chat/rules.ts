/**
 * The deterministic rung of the chat parser.
 *
 * Handles the sentences that make up most real updates — "X is done",
 * "payment came in from Y", "sent Z the proposal, 80k" — with no model call,
 * so the chat keeps working when the API key is empty, which is exactly the
 * failure that killed invoice parsing for a month. The model rung refines
 * what this cannot read; it never replaces it.
 */

export type IntentAction =
  | "mark_done"
  | "mark_paid"
  | "set_status"
  | "add_note"
  | "create_payment"
  | "create_proposal"
  | "question"
  | "unknown";

export type Intent = {
  action: IntentAction;
  /** which table the action is about, when the words say */
  target: "project" | "payment" | "proposal" | null;
  /** the status a set_status asks for */
  status: string | null;
  /** rupees, decoded from 80k / 1.2L / 1,20,000 forms */
  amount: number | null;
  /** "50% advance came in" — the share, when the words give one instead of rupees */
  pct: number | null;
  /** free text that should name the brand and/or the work */
  subject: string;
  raw: string;
};

/** "80k" → 80000, "1.2L" / "1.2 lakh" → 120000, "1cr" → 10000000, "1,20,000" → 120000 */
export function parseAmount(text: string): number | null {
  const suffixed = text.match(/(?:₹|rs\.?\s*|inr\s*)?(\d+(?:\.\d+)?)\s*(k|l|lakh|lakhs|cr|crore)s?\b/i);
  if (suffixed) {
    const n = Number(suffixed[1]);
    const unit = suffixed[2].toLowerCase();
    const mult = unit === "k" ? 1_000 : unit.startsWith("l") ? 100_000 : 10_000_000;
    return Math.round(n * mult);
  }
  const grouped = text.match(/(?:₹|rs\.?\s*|inr\s*)([\d,]{4,}(?:\.\d{1,2})?)/i);
  if (grouped) {
    const n = Number(grouped[1].replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  const bare = text.match(/\b(\d{4,9})\b/);
  if (bare) return Number(bare[1]);
  return null;
}

const QUESTION_RE =
  /^(?:what|how|when|where|who|which|why|is|are|do|does|did|show|tell|any|status of|what's|whats|how's|hows)\b|\?\s*$/i;

const DONE_RE = /\b(?:is done|are done|done|completed?|finished|delivered|shipped|wrapped(?:\s+up)?|closed out|went live|launched)\b/i;
// "came in" / "landed" with no other verb is money in this domain — updates
// are dictated shorthand ("kosh 50% came in"), not full sentences.
const PAID_RE = /\b(?:paid|payment (?:came|come|received|landed|cleared|confirmed|in)|received (?:the )?(?:payment|money|amount|advance)|money (?:came|landed|received|in)|transferred|credited|came in|come in|landed|cleared)\b/i;
const HOLD_RE = /\b(?:on hold|hold|park(?:ed)?|pause[d]?|stop work)\b/i;
const RESUME_RE = /\b(?:resume[d]?|go ahead|green ?light|start work|kick(?:ed)? off|activate[d]?|un ?park(?:ed)?)\b/i;
const WAITING_RE = /\b(?:waiting|blocked|stuck|held up)\b/i;
const PROPOSAL_RE = /\b(?:proposal|quote[d]?|pitch(?:ed)?|estimate)\b/i;
const SENT_RE = /\b(?:sent|shared|mailed|submitted)\b/i;
const NOTE_RE = /^note[:\s]/i;
const INVOICE_RE = /\b(?:invoice[d]?|billed|raise[d]? (?:an? )?invoice)\b/i;

/** "50%" → 50. Distinct from parseAmount so 50 never reads as ₹50. */
export function parsePct(text: string): number | null {
  const m = text.match(/\b(\d{1,2}(?:\.\d+)?)\s*%/);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 && n <= 100 ? n : null;
}

export function parseWithRules(text: string): Intent {
  const raw = text.trim();
  const pct = parsePct(raw);
  // A number that was a percentage must not also be read as rupees.
  const amount = pct !== null ? parseAmount(raw.replace(/\d{1,2}(?:\.\d+)?\s*%/, "")) : parseAmount(raw);
  const base = { amount, pct, subject: raw, raw, status: null as string | null };

  if (NOTE_RE.test(raw)) {
    return { ...base, action: "add_note", target: null, subject: raw.replace(NOTE_RE, "").trim() };
  }
  if (QUESTION_RE.test(raw)) {
    return { ...base, action: "question", target: null };
  }
  if (PAID_RE.test(raw)) {
    return { ...base, action: "mark_paid", target: "payment" };
  }
  if (DONE_RE.test(raw)) {
    return { ...base, action: "mark_done", target: "project" };
  }
  if (HOLD_RE.test(raw)) {
    return { ...base, action: "set_status", target: "project", status: "parked" };
  }
  if (WAITING_RE.test(raw)) {
    return { ...base, action: "set_status", target: "project", status: "waiting" };
  }
  if (RESUME_RE.test(raw)) {
    return { ...base, action: "set_status", target: "project", status: "active" };
  }
  if (PROPOSAL_RE.test(raw) && SENT_RE.test(raw)) {
    return { ...base, action: "create_proposal", target: "proposal" };
  }
  if (INVOICE_RE.test(raw)) {
    return { ...base, action: "create_payment", target: "payment" };
  }
  return { ...base, action: "unknown", target: null };
}
