"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Megaphone, RefreshCw } from "lucide-react";
import { money, moneyShort } from "@/lib/format";
import { StatusPill, type Tone } from "@/components/ui/StatusPill";

type Campaign = {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  results: number | null;
  resultLabel: string | null;
  costPerResult: number | null;
};

type Summary = {
  currency: string;
  accountName: string | null;
  since: string;
  until: string;
  spend: number;
  impressions: number;
  clicks: number;
  campaigns: Campaign[];
};

type Payload = { configured: boolean; error: string | null; detail?: string; data: Summary | null };

/** Meta's effective_status vocabulary, mapped to the shared pill tones. */
function statusTone(s: string): Tone {
  const v = s.toUpperCase();
  if (v === "ACTIVE") return "good";
  if (v === "PAUSED") return "neutral";
  if (v.includes("DISAPPROVED") || v.includes("REJECTED")) return "bad";
  if (v.includes("PENDING") || v.includes("REVIEW")) return "warn";
  return "neutral";
}

/**
 * Live ad spend from the connected Meta account.
 *
 * Reports three states separately, because the fix differs for each: not
 * connected (add credentials), connected but failing (usually an expired token),
 * and connected with nothing running (no campaigns spent in the window).
 */
export function AdsPanel() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/ops/ads")
      .then((r) => r.json())
      .catch(() => ({ configured: false, error: "Could not reach the ads endpoint.", data: null }));
    setPayload(res);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const d = payload?.data;

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-panel border border-[var(--border)] bg-surface shadow-card">
      <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-2 pt-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[13.5px] font-semibold tracking-tight text-text">
            <Megaphone size={15} className="text-text-muted" /> Ads running
          </h2>
          <p className="mt-0.5 truncate text-[11px] text-text-muted">
            {d ? `${d.accountName ?? "Meta"}, ${d.since || "last 30 days"} to ${d.until || "today"}` : "Meta campaign spend"}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          aria-label="Refresh ads"
          className="shrink-0 rounded-pill p-1.5 text-text-muted transition-colors hover:text-text disabled:opacity-50"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        </button>
      </div>

      {loading ? (
        <p className="px-4 py-8 text-center text-[12px] text-text-muted">Loading.</p>
      ) : payload?.configured === false ? (
        <div className="px-4 py-6 text-center">
          <p className="text-[12px] text-text-muted">{payload.detail ?? "Not connected."}</p>
          <a
            href="https://business.facebook.com/settings/system-users"
            target="_blank" rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-[var(--brand-text)] hover:underline"
          >
            Create a System User token <ExternalLink size={11} />
          </a>
          {/* Named because a user token dies after ~60 days and the panel would
              then go quietly stale rather than visibly break. */}
          <p className="mt-1 text-[10.5px] text-text-muted">A System User token does not expire.</p>
        </div>
      ) : payload?.error ? (
        <p className="mx-4 mb-4 rounded-soft bg-[rgba(255,68,68,0.1)] px-3 py-2 text-[11.5px] text-accent-red">
          {payload.error}
        </p>
      ) : !d || d.campaigns.length === 0 ? (
        <p className="px-4 py-8 text-center text-[12px] text-text-muted">
          Connected, but nothing spent in this window.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 px-4 pb-3">
            {[
              { l: "Spend", v: money(d.spend) },
              { l: "Impressions", v: d.impressions.toLocaleString("en-IN") },
              { l: "Clicks", v: d.clicks.toLocaleString("en-IN") },
            ].map((s) => (
              <div key={s.l} className="min-w-0">
                <p className="truncate text-[15px] font-bold tabular-nums text-text">{s.v}</p>
                <p className="truncate text-[10px] text-text-muted">{s.l}</p>
              </div>
            ))}
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto">
            {d.campaigns.map((c) => (
              <li key={c.id} className="border-t border-[var(--border)] px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-text">{c.name}</span>
                  {c.status && <StatusPill status={c.status.toLowerCase()} tone={statusTone(c.status)} />}
                  <span className="shrink-0 whitespace-nowrap text-[12px] font-semibold tabular-nums text-text">
                    {moneyShort(c.spend)}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[10.5px] text-text-muted">
                  <span>{c.impressions.toLocaleString("en-IN")} impressions</span>
                  <span>{c.clicks.toLocaleString("en-IN")} clicks</span>
                  {c.ctr != null && <span>{c.ctr.toFixed(2)}% CTR</span>}
                  {/* Results only mean something next to their own label: a lead
                      and a link click are not comparable numbers. */}
                  {c.results != null && c.resultLabel && (
                    <span className="text-text">{c.results.toLocaleString("en-IN")} {c.resultLabel}</span>
                  )}
                  {c.costPerResult != null && c.resultLabel && (
                    <span>{money(Math.round(c.costPerResult))} per {c.resultLabel.replace(/s$/, "")}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
