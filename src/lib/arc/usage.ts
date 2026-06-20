// Token-usage accounting. Aggregates Claude API spend into arc_context (no new
// table needed). Read by the Config page so you can see token burn + est cost.
import { supabaseAdmin } from "@/lib/supabase";

const USAGE_KEY = "token_usage";

// Estimated USD per 1M tokens. Adjust if Anthropic pricing changes.
export const PRICING: Record<string, { in: number; out: number }> = {
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5-20251001": { in: 1, out: 5 },
  "claude-haiku-4-5": { in: 1, out: 5 },
  default: { in: 3, out: 15 },
};

export interface UsageStats {
  total_input: number;
  total_output: number;
  total_cost_usd: number;
  calls: number;
  by_model: Record<string, { input: number; output: number; calls: number; cost_usd: number }>;
  by_action: Record<string, { input: number; output: number; calls: number }>;
  updated_at: string;
}

function empty(): UsageStats {
  return { total_input: 0, total_output: 0, total_cost_usd: 0, calls: 0, by_model: {}, by_action: {}, updated_at: "" };
}

export function costOf(model: string, input: number, output: number): number {
  const p = PRICING[model] || PRICING.default;
  return (input / 1e6) * p.in + (output / 1e6) * p.out;
}

export async function getUsage(): Promise<UsageStats> {
  try {
    const { data } = await supabaseAdmin.from("arc_context").select("value").eq("key", USAGE_KEY).single();
    if (data?.value) return { ...empty(), ...JSON.parse(data.value as string) };
  } catch {
    /* no row yet */
  }
  return empty();
}

// Increment the running totals. Best-effort: never throws into the caller.
export async function recordUsage(model: string, input: number, output: number, action: string): Promise<void> {
  if (!input && !output) return;
  try {
    const u = await getUsage();
    const cost = costOf(model, input, output);
    u.total_input += input;
    u.total_output += output;
    u.total_cost_usd += cost;
    u.calls += 1;
    const m = u.by_model[model] || { input: 0, output: 0, calls: 0, cost_usd: 0 };
    m.input += input; m.output += output; m.calls += 1; m.cost_usd += cost;
    u.by_model[model] = m;
    const a = u.by_action[action] || { input: 0, output: 0, calls: 0 };
    a.input += input; a.output += output; a.calls += 1;
    u.by_action[action] = a;
    u.updated_at = new Date().toISOString();
    await supabaseAdmin.from("arc_context").upsert({ key: USAGE_KEY, value: JSON.stringify(u), updated_at: u.updated_at });
  } catch (e) {
    console.error("[usage] record failed:", e);
  }
}

export async function resetUsage(): Promise<void> {
  try {
    await supabaseAdmin.from("arc_context").upsert({ key: USAGE_KEY, value: JSON.stringify(empty()), updated_at: new Date().toISOString() });
  } catch (e) {
    console.error("[usage] reset failed:", e);
  }
}
