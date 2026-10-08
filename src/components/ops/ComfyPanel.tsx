"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { StatusPill, type Tone } from "@/components/ui/StatusPill";

/**
 * Comfy Cloud on the Editr page: every clip we generated there, and what Comfy billed.
 * Read live from /api/ops/comfy. Totals come from Comfy's billing; Comfy doesn't bill per job,
 * so each clip's cost is an estimate (its day's spend shared by run time) and is labelled so.
 */

type Clip = { id: string; status: string; created: string; day: string; file: string | null; run_seconds: number; outputs: number; est_cost_usd: number | null };
type Report =
  | { configured: false }
  | {
      configured: true; total_spend_usd: number; balance: { amount: number; currency: string } | null; months: number;
      jobs: { total: number; completed: number; failed: number };
      clips_completed: number; clips_failed: number; clip_seconds_run: number;
      by_model: { model: string; usd: number; share: number }[];
      days: { day: string; usd: number; clips: number }[];
      clips: Clip[];
    };

const usd = (n: number) => `$${n >= 1000 ? Math.round(n).toLocaleString("en-US") : n.toFixed(2)}`;
const TONE: Record<string, Tone> = { completed: "good", failed: "bad", cancelled: "neutral", in_progress: "info", pending: "info" };
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Box({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2.5">
      <p className="text-[10.5px] uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-0.5 text-[18px] font-semibold tabular-nums text-text">{value}</p>
      {hint && <p className="text-[11px] text-text-muted">{hint}</p>}
    </div>
  );
}

export function ComfyPanel() {
  const [r, setR] = useState<Report | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/ops/comfy", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setR(j); setErr(null);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const csv = useMemo(() => {
    if (!r || !r.configured) return null;
    const rows = [["created", "status", "file", "run_seconds", "est_cost_usd", "job_id"],
      ...r.clips.map((c) => [c.created, c.status, c.file || "", c.run_seconds.toFixed(1), c.est_cost_usd?.toFixed(4) ?? "", c.id])];
    return URL.createObjectURL(new Blob([rows.map((x) => x.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" }));
  }, [r]);

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-panel border border-[var(--border)] bg-surface shadow-card">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 px-4 pb-2 pt-3.5">
        <div>
          <h2 className="text-[13.5px] font-semibold tracking-tight text-text">Comfy Cloud clips</h2>
          <p className="mt-0.5 text-[11px] text-text-muted">Live from Comfy. Spend is what Comfy billed; per-clip cost is an estimate, since Comfy bills by day and model.</p>
        </div>
        <div className="flex items-center gap-2">
          {csv && <a href={csv} download="comfy-clips.csv" className="text-[11.5px] text-text-muted hover:text-text">Download CSV</a>}
          <button onClick={load} disabled={busy} aria-label="Refresh" className="rounded-soft p-1.5 text-text-muted hover:bg-[var(--surface-hover)] hover:text-text disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-4 pb-4">
        {err ? (
          <p className="text-[12px] text-accent-red">Couldn&apos;t reach Comfy: {err}</p>
        ) : !r ? (
          <p className="text-[12px] text-text-muted">Loading…</p>
        ) : !r.configured ? (
          <p className="text-[12px] text-text-muted">
            Not connected. Make an API key at platform.comfy.org/profile/api-keys and set it as <code className="text-text">COMFY_API_KEY</code> in
            the ARC environment (Vercel and .env.local). The API needs a Creator or Pro plan.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Box label="Clips made" value={String(r.clips_completed)} hint={`${r.clips_failed} failed · ${r.jobs.total} jobs in all`} />
              <Box label={`Spend, last ${r.months} months`} value={usd(r.total_spend_usd)}
                hint={r.clips_completed ? `about ${usd(r.total_spend_usd / r.clips_completed)} per clip, all jobs included` : undefined} />
              <Box label="GPU run time on clips" value={`${(r.clip_seconds_run / 60).toFixed(1)} min`} />
              <Box label="Balance left" value={r.balance ? `${r.balance.currency === "USD" ? "$" : r.balance.currency + " "}${r.balance.amount.toFixed(2)}` : "-"} />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_2fr]">
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">By model</p>
                <ul className="flex flex-col gap-1.5 text-[12px]">
                  {r.by_model.map((m) => (
                    <li key={m.model} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-text" title={m.model}>{m.model}</span>
                      <span className="w-10 text-right text-[10.5px] tabular-nums text-text-muted">{Math.round(m.share * 100)}%</span>
                      <span className="w-16 text-right tabular-nums text-text">{usd(m.usd)}</span>
                    </li>
                  ))}
                  {!r.by_model.length && <li className="text-text-muted">No spend in this range.</li>}
                </ul>
                <p className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-wide text-text-muted">By day</p>
                <ul className="flex max-h-[220px] flex-col gap-1 overflow-auto text-[12px]">
                  {[...r.days].reverse().map((d) => (
                    <li key={d.day} className="flex items-center gap-2">
                      <span className="flex-1 text-text">{d.day}</span>
                      <span className="text-[10.5px] text-text-muted">{d.clips} clip{d.clips === 1 ? "" : "s"}</span>
                      <span className="w-16 text-right tabular-nums text-text">{usd(d.usd)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="min-w-0">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">Every clip ({r.clips.length})</p>
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full text-[12px]">
                    <thead><tr className="text-left text-[10.5px] uppercase tracking-wide text-text-muted">
                      <th className="py-1 font-medium">Made</th><th className="py-1 font-medium">File</th><th className="py-1 font-medium">Status</th>
                      <th className="py-1 text-right font-medium">Run</th><th className="py-1 text-right font-medium">Est. cost</th></tr></thead>
                    <tbody>
                      {(all ? r.clips : r.clips.slice(0, 100)).map((c) => (
                        <tr key={c.id} className="border-t border-[var(--border)]">
                          <td className="whitespace-nowrap py-1.5 pr-2 text-text-muted">{when(c.created)}</td>
                          <td className="max-w-[260px] truncate py-1.5 pr-2 text-text" title={c.file || c.id}>{c.file || c.id.slice(0, 8)}</td>
                          <td className="py-1.5 pr-2"><StatusPill status={c.status.replace("_", " ")} tone={TONE[c.status]} /></td>
                          <td className="py-1.5 text-right tabular-nums">{c.run_seconds ? `${c.run_seconds.toFixed(0)}s` : "-"}</td>
                          <td className="py-1.5 text-right tabular-nums">{c.est_cost_usd != null ? `~${usd(c.est_cost_usd)}` : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!all && r.clips.length > 100 && (
                  <button onClick={() => setAll(true)} className="mt-2 text-[11.5px] text-text-muted hover:text-text">Show all {r.clips.length}</button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
