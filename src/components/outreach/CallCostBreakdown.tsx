import { money, type CallCosts } from "@/lib/outreach-costs";
export function CallCostBreakdown({ costs, compact = false }: { costs?: CallCosts; compact?: boolean }) {
  const v = costs?.vobiz;
  const vobiz = v?.amount != null && v.currency ? money(v.amount, v.currency) : "Unavailable";
  if (compact) return <div className="space-y-1 whitespace-nowrap text-xs">
    <p>Vobiz: {vobiz}</p><p>ElevenLabs: {money(costs?.elevenlabs_usd)}</p>
    <p className="text-text-muted">{costs?.tokens ? costs.tokens.total.toLocaleString("en-IN") + " tokens" : "Tokens unavailable"}</p>
  </div>;
  return <section aria-label="Call cost" className="space-y-3 rounded-lg border border-[var(--border)] p-4">
    <h3 className="font-medium">Call cost &amp; tokens</h3>
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
      <dt>Vobiz telephony</dt><dd className="text-right tabular-nums">{vobiz}</dd>
      <dt>ElevenLabs total</dt><dd className="text-right tabular-nums">{money(costs?.elevenlabs_usd)}</dd>
      <dt className="text-text-muted">Voice / platform</dt><dd className="text-right text-text-muted">{money(costs?.platform_usd)}</dd>
      <dt className="text-text-muted">AI model, included above</dt><dd className="text-right text-text-muted">{money(costs?.llm_usd)}</dd>
      <dt>ElevenLabs credits</dt><dd className="text-right">{costs?.elevenlabs_credits?.toLocaleString("en-IN") ?? "Unavailable"}</dd>
      <dt>Tokens used</dt><dd className="text-right font-medium">{costs?.tokens?.total.toLocaleString("en-IN") ?? "Unavailable"}</dd>
    </dl>
    {costs?.tokens && <details><summary className="cursor-pointer text-sm text-text-muted">Token breakdown</summary><p className="mt-2 text-sm text-text-muted">Input: {costs.tokens.input.toLocaleString("en-IN")} · Output: {costs.tokens.output.toLocaleString("en-IN")} · Cache read: {costs.tokens.cache_read.toLocaleString("en-IN")} · Cache write: {costs.tokens.cache_write.toLocaleString("en-IN")}</p><p className="mt-2 text-xs text-text-muted">Includes initiated generations, even if interrupted.</p></details>}
    <p className="text-xs leading-relaxed text-text-muted">Provider-reported usage. Credits are separate from tokens. Currency is shown per provider; no conversion or extra model charge is added.</p>
    {vobiz === "Unavailable" && <p className="text-xs text-text-muted">{v?.status === "not_configured" ? "Vobiz billing connection is not configured." : v?.status === "unmatched" ? "No matching Vobiz billing record yet." : "Vobiz billing is unavailable. Refresh after billing finishes."} Full call total is incomplete.</p>}
  </section>;
}
