// Reads an Indian bank transaction SMS (HDFC, ICICI and most others) into one
// structured row. Best effort and deliberately conservative: anything that is not
// clearly a credit or debit with an amount returns null and is dropped.
//
// Never stores a balance: available balance / limit clauses are cut from the body
// before anything else happens.

import { createHash } from "crypto";

export type BankTxn = {
  dedupe_key: string;
  bank: string | null;
  account: string | null;
  direction: "credit" | "debit";
  amount: number;
  txn_at: string;
  channel: string | null;
  counterparty: string | null;
  ref: string | null;
  sender: string;
  body: string;
};

const OTP = /\b(otp|one[\s-]?time\s+password|verification\s+code|passcode)\b/i;
const NOT_A_TXN = /\b(will be debited|is due|due on|due date|bill (?:of|for)|request(?:ed)? (?:for|of)|collect request|has requested|e-?mandate|auto[\s-]?pay set|pre-?approved|offer|loan of|statement)\b/i;
const TXN_HINT = /\b(a\/c|acct|account|card|upi|neft|imps|rtgs|vpa)\b/i;

const BALANCE = /(?:avl|avbl|available|total)\.?\s*(?:bal(?:ance)?|lmt|limit|amt)\.?\s*(?:is)?\s*:?\s*(?:rs\.?|inr|₹)?\s*-?[\d,]+(?:\.\d{1,2})?/gi;

const BANKS: [RegExp, string][] = [
  [/hdfc/i, "HDFC"],
  [/icici/i, "ICICI"],
  [/\bsbi|sbiinb|sbipsg/i, "SBI"],
  [/axis/i, "Axis"],
  [/kotak|kotakb/i, "Kotak"],
  [/yes\s?b|yesbnk/i, "Yes Bank"],
  [/idfc/i, "IDFC First"],
  [/indus|indusb/i, "IndusInd"],
  [/federal|fedbnk/i, "Federal"],
  [/canara|canbnk/i, "Canara"],
  [/union\s?b|unionb/i, "Union Bank"],
  [/bob|baroda/i, "Bank of Baroda"],
  [/au\s?bank|aubank/i, "AU Bank"],
];

function bankOf(sender: string, body: string): string | null {
  for (const [re, name] of BANKS) if (re.test(sender)) return name;
  for (const [re, name] of BANKS) if (re.test(body)) return name;
  return null;
}

function directionOf(b: string): "credit" | "debit" | null {
  // Debit words win: ICICI debit SMS end in "<payee> credited".
  if (/\b(debited|spent|withdrawn|sent\s+(?:rs|inr|₹)|paid\s+(?:rs|inr|₹)|debit(?:ed)?\s+(?:by|for|with)|purchase\s+of|txn\s+of\s+(?:rs|inr|₹)[\d,.\s]+(?:on|at)\b.*\bcard)\b/i.test(b)) return "debit";
  if (/\b(credited|deposited|received|credit(?:ed)?\s+(?:by|with|of)|cr\.?\s+(?:rs|inr|₹)|refund)\b/i.test(b)) return "credit";
  return null;
}

function amountOf(b: string): number | null {
  const m = b.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function accountOf(b: string): string | null {
  const m = b.match(/(?:a\/c|acct|account|card)\s*(?:no\.?)?\s*(?:ending\s*(?:with)?\s*)?[x*\s]*(\d{3,6})\b/i);
  return m ? m[1].slice(-4) : null;
}

function channelOf(b: string): string | null {
  if (/\bneft\b/i.test(b)) return "NEFT";
  if (/\brtgs\b/i.test(b)) return "RTGS";
  if (/\bimps\b/i.test(b)) return "IMPS";
  if (/\bupi\b|\bvpa\b/i.test(b)) return "UPI";
  if (/\batm\b/i.test(b)) return "ATM";
  if (/\bcard\b/i.test(b)) return "Card";
  return null;
}

function refOf(b: string): string | null {
  const m =
    b.match(/(?:upi\s*ref(?:\s*no)?|ref(?:erence)?\s*(?:no|number)?|utr(?:\s*no)?|rrn|upi)\s*[:.\-]?\s*([A-Z0-9]{8,22})\b/i) ||
    b.match(/\b([A-Z]{4}(?=[A-Z0-9]*\d)[A-Z0-9]{8,18})\b/); // NEFT/RTGS UTR, e.g. BARBD26264503446
  return m ? m[1] : null;
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").replace(/[\s.,;:\-]+$/, "").trim().slice(0, 120);
}

function counterpartyOf(b: string, dir: "credit" | "debit"): string | null {
  const vpa = b.match(/\b([\w.\-]{2,}@[a-z]{2,})\b/i);
  // NEFT/IMPS narration: "NEFT Cr-IFSC-NAME-..." or "Info: NEFT-XXX-NAME"
  const neft = b.match(/(?:neft|imps|rtgs)\s*(?:cr|dr)?\s*[-:]\s*[A-Z]{4}0[A-Z0-9]{6}\s*-\s*([^-]{3,60})-/i);
  if (neft) return clean(neft[1]);
  const INFO = /\binfo[:\s]+(?:(?:neft|imps|rtgs|upi)[-\/:])?([^.\n]{3,60})/i;
  const pats =
    dir === "credit"
      ? [/\bfrom\s+(?:vpa\s+)?(?:a\/c\s+linked\s+to\s+vpa\s+)?([^.(\n]{3,60}?)(?:\s+on\b|\s*\(|\.|$)/i, /\bby\s+([^.(\n]{3,60}?)(?:\s+on\b|\s*\(|\.|$)/i, INFO]
      : [/;\s*([^;.\n]{3,60}?)\s+credited/i, /\bat\s+([A-Z][^.(\n]{2,60}?)\s+on\b/i, /\bto\s+(?:vpa\s+)?([^.(\n]{3,60}?)(?:\s+on\b|\s*\(|\.|$)/i, INFO];
  for (const re of pats) {
    const m = b.match(re);
    if (m && !/^(your|hdfc|icici|a\/c|acct|account)\b/i.test(m[1].trim())) return clean(m[1]);
  }
  return vpa ? vpa[1] : null;
}

export function stripBalance(body: string): string {
  return body.replace(BALANCE, "[bal]");
}

export function parseBankSms(sender: string, rawBody: string, receivedAtMs: number): BankTxn | null {
  if (!rawBody || OTP.test(rawBody) || NOT_A_TXN.test(rawBody)) return null;
  const body = stripBalance(rawBody).replace(/\s+/g, " ").trim();
  if (!TXN_HINT.test(body)) return null;
  const direction = directionOf(body);
  const amount = amountOf(body);
  if (!direction || amount == null) return null;

  const bank = bankOf(sender, body);
  const account = accountOf(body);
  const ref = refOf(body);
  const txn_at = new Date(receivedAtMs || Date.now()).toISOString();
  const key = ref
    ? `${bank}|${account}|${direction}|${amount}|${ref}`
    : `${sender}|${body}|${Math.floor((receivedAtMs || 0) / 60000)}`;

  return {
    dedupe_key: createHash("sha256").update(key).digest("hex").slice(0, 40),
    bank,
    account,
    direction,
    amount,
    txn_at,
    channel: channelOf(body),
    counterparty: counterpartyOf(body, direction),
    ref,
    sender: sender.slice(0, 40),
    body: body.slice(0, 600),
  };
}
