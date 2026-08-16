import type { Brand } from "@/types/ops";
import { brandKeys } from "@/lib/rollup";

/**
 * Server-side brand attribution.
 *
 * Two signals, tried in order of reliability:
 *  - the counterparty's email domain against brands.domains — the column was
 *    being stored and edited but nothing ever read it, so the invoice queue
 *    fell back to fuzzy word matching
 *  - a free-text haystack against every name and alias, longest key wins, so
 *    "Laptop Store India" beats "Laptop Store" when both match
 */

function emailDomain(address: string | null | undefined): string | null {
  if (!address) return null;
  const m = String(address).toLowerCase().match(/@([a-z0-9.-]+)/);
  return m ? m[1] : null;
}

const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.in", "outlook.com",
  "hotmail.com", "live.com", "icloud.com", "me.com", "proton.me", "rediffmail.com",
]);

/** The brand whose registered domain matches the sender's. Free-mail domains never match. */
export function brandForEmail(from: string | null | undefined, brands: Brand[]): Brand | null {
  const domain = emailDomain(from);
  if (!domain || FREE_MAIL.has(domain)) return null;
  for (const b of brands) {
    for (const d of b.domains ?? []) {
      const clean = String(d).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
      if (!clean) continue;
      if (domain === clean || domain.endsWith(`.${clean}`)) return b;
    }
  }
  return null;
}

/** The brand whose name or alias appears in the text; the longest match wins. */
export function brandForText(text: string | null | undefined, brands: Brand[]): Brand | null {
  if (!text) return null;
  const hay = text.toLowerCase();
  let best: Brand | null = null;
  let bestLen = 0;
  for (const b of brands) {
    for (const key of brandKeys(b)) {
      // Keys under 4 characters match everything; that is noise, not a signal.
      if (key.length < 4 || key.length <= bestLen) continue;
      if (hay.includes(key)) { best = b; bestLen = key.length; }
    }
  }
  if (best) return best;

  // Word-level fallback: "kosh" should find Kosh Studios even though the full
  // key never appears. A word only counts when exactly one brand owns it —
  // an ambiguous word is a question for the human, not a guess.
  const owners = new Map<string, Brand | null>();
  for (const b of brands) {
    for (const key of brandKeys(b)) {
      for (const word of key.split(/\s+/)) {
        if (word.length < 4) continue;
        const prev = owners.get(word);
        if (prev === undefined) owners.set(word, b);
        else if (prev !== null && prev.id !== b.id) owners.set(word, null);
      }
    }
  }
  for (const token of hay.split(/[^a-z0-9]+/)) {
    if (token.length < 4) continue;
    const owner = owners.get(token);
    if (owner) return owner;
  }
  return null;
}
