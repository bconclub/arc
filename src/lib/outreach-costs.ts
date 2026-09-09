type TokenCategory = { tokens?: number };
type ModelUsage = Record<string, TokenCategory>;
type BillingRecord = {
  metadata?: { cost?: unknown; cost_fiat?: unknown; charging?: {
    platform_price?: unknown; llm_price?: unknown;
    llm_usage?: { initiated_generation?: { model_usage?: Record<string, ModelUsage> } };
  } };
  vobiz?: { amount?: unknown; currency?: unknown; status?: string; billable_seconds?: unknown };
};
export type CallCosts = {
  elevenlabs_usd: number | null;
  platform_usd: number | null;
  llm_usd: number | null;
  elevenlabs_credits: number | null;
  tokens: { total: number; input: number; output: number; cache_read: number; cache_write: number } | null;
  vobiz: { amount: number | null; currency: string | null; status: string; billable_seconds: number | null };
};
const number = (v: unknown): number | null => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
export function callCosts(d: BillingRecord | null | undefined): CallCosts {
  const m = d?.metadata || {}, c = m.charging || {};
  // Initiated generation includes interrupted/speculative work. Do not add the
  // irreversible subset or detailed_model_usage, which duplicate this usage.
  const models = c.llm_usage?.initiated_generation?.model_usage;
  let tokens: CallCosts["tokens"] = null;
  if (models && typeof models === "object" && Object.keys(models).length) {
    const values = Object.values(models) as ModelUsage[];
    const categories = ["input", "output_total", "input_cache_read", "input_cache_write"];
    if (values.every(v => categories.every(k => number(v?.[k]?.tokens) !== null))) {
      const sum = (key: string) => values.reduce((n, v) => n + (v[key].tokens as number), 0);
      const input = sum("input"), output = sum("output_total"), cache_read = sum("input_cache_read"), cache_write = sum("input_cache_write");
      tokens = { total: input + output + cache_read + cache_write, input, output, cache_read, cache_write };
    }
  }
  const platform = number(c.platform_price), llm = number(c.llm_price);
  const v = d?.vobiz;
  return {
    elevenlabs_usd: number(m.cost_fiat),
    platform_usd: platform, llm_usd: llm, elevenlabs_credits: number(m.cost), tokens,
    vobiz: { amount: number(v?.amount), currency: typeof v?.currency === "string" && /^[A-Z]{3}$/.test(v.currency) ? v.currency : null, status: v?.status || "unavailable", billable_seconds: number(v?.billable_seconds) },
  };
}
export function money(amount: number | null | undefined, currency = "USD") {
  return amount == null ? "Unavailable" : new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(amount);
}
