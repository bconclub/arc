/**
 * Claude API list prices, USD per million tokens, for valuing Editr's token use.
 *
 * Source: platform.claude.com/docs/en/about-claude/pricing, read 2026-10-05. Update this table
 * when Anthropic changes prices; nothing else hardcodes a rate.
 *
 * This is the API-EQUIVALENT value of the work. BCON pays a flat Claude Code Max plan, recorded in
 * `expenses` (vendor Anthropic), not per token. The page shows both so the plan's worth is visible.
 */

export type Rates = { input: number; write5m: number; write1h: number; read: number; output: number };

const R = (input: number, write5m: number, write1h: number, read: number, output: number): Rates =>
  ({ input, write5m, write1h, read, output });

export const PRICES: Record<string, Rates> = {
  "claude-fable-5-1": R(10, 12.5, 20, 0.25, 50),
  "claude-fable-5": R(10, 12.5, 20, 1, 50),
  "claude-opus-5-5": R(4, 5, 8, 0.2, 20),
  "claude-opus-5": R(5, 6.25, 10, 0.5, 25),
  "claude-opus-4-8": R(5, 6.25, 10, 0.5, 25),
  "claude-opus-4-7": R(5, 6.25, 10, 0.5, 25),
  "claude-opus-4-6": R(5, 6.25, 10, 0.5, 25),
  "claude-sonnet-5-5": R(2, 2.5, 4, 0.2, 10),
  "claude-sonnet-5": R(2, 2.5, 4, 0.2, 10),
  "claude-sonnet-4-6": R(3, 3.75, 6, 0.3, 15),
  "claude-haiku-4-5": R(1, 1.25, 2, 0.1, 5),
};

/** Fast mode doubles every rate on the models that offer it (Opus 5.5, Opus 5, Opus 4.8). */
const FAST_MULTIPLIER = 2;

export type UsageRow = {
  model: string;
  speed?: string;
  input: number;
  output: number;
  cache_read: number;
  cache_write_5m: number;
  cache_write_1h: number;
};

/** Cost in USD. Unknown models (e.g. Claude Code's "<synthetic>" rows) cost 0 and are reported. */
export function costUsd(u: UsageRow): { usd: number; priced: boolean } {
  const base = PRICES[u.model.replace(/-\d{8}$/, "")];
  if (!base) return { usd: 0, priced: false };
  const m = u.speed === "fast" ? FAST_MULTIPLIER : 1;
  const usd =
    (u.input * base.input +
      u.output * base.output +
      u.cache_read * base.read +
      u.cache_write_5m * base.write5m +
      u.cache_write_1h * base.write1h) * m / 1_000_000;
  return { usd, priced: true };
}
