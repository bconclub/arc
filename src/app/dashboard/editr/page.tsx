"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clapperboard, Coins, Cpu, Wallet } from "lucide-react";
import { money, timeAgo } from "@/lib/format";
import { SegmentedTabs, type Tab } from "@/components/ui/SegmentedTabs";
import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { StatusPill, type Tone } from "@/components/ui/StatusPill";
import { ComfyPanel } from "@/components/ops/ComfyPanel";
import { OutputBreakdown } from "@/components/ops/OutputBreakdown";

/**
 * Editr: what the video and content agents cost, made and are doing.
 *
 * Fed by `python scripts/tasks.py sync` from the bconclub/editor repo on each machine.
 * Token cost is the API-list-price value of the work (lib/editr/pricing.ts). What BCON actually
 * pays is the flat Claude Code plan, read from expenses (vendor Anthropic). Both are shown, never
 * blended, so the page can't imply a per-token bill that doesn't exist.
 */

type Usage = {
  day: string; agent: string; host: string; model: string; speed: string;
  input: number; output: number; cache_read: number; cache_write_5m: number; cache_write_1h: number;
  messages: number; cost_usd: number; updated_at: string;
};
type Output = { id: string; date: string; task: string; agent: string; kind: string; file: string; seconds: number; width: number | null; height: number | null; brand: string | null };
type Task = {
  id: string; title: string; brand: string | null; owner: string | null; status: string; effective: string;
  priority: string | null; due: string | null; blocked_by: string[]; waiting_on: string | null; output: string | null;
  progress_done: number; progress_total: number; last_log: string | null; updated_at: string; type: string | null;
};
type Event = { id: number; task_id: string; at: string; from_status: string | null; to_status: string; note: string | null; host: string | null };
type Spend = { spent_on: string | null; created_at: string; amount: number; currency: string; description: string | null };
type Data = { usage: Usage[]; outputs: Output[]; tasks: Task[]; events: Event[]; anthropicSpend: Spend[] };

const tok = (u: Usage) => u.input + u.output + u.cache_read + u.cache_write_5m + u.cache_write_1h;
const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const fmtN = (n: number) => n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n));
const usd = (n: number) => `$${n >= 1000 ? Math.round(n).toLocaleString("en-US") : n.toFixed(2)}`;
const mins = (s: number) => `${(s / 60).toFixed(1)} min`;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const daysBack = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return isoDay(d); };

const STATUS: { key: string; label: string; tone: Tone }[] = [
  { key: "doing", label: "Doing", tone: "info" },
  { key: "todo", label: "To do", tone: "neutral" },
  { key: "blocked", label: "Blocked", tone: "bad" },
  { key: "review", label: "Review", tone: "warn" },
  { key: "done", label: "Done", tone: "good" },
];

function Panel({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex min-w-0 flex-col overflow-hidden rounded-panel border border-[var(--border)] bg-surface shadow-card ${className}`}>
      <div className="shrink-0 px-4 pb-2 pt-3.5">
        <h2 className="text-[13.5px] font-semibold tracking-tight text-text">{title}</h2>
        {sub && <p className="mt-0.5 text-[11px] text-text-muted">{sub}</p>}
      </div>
      <div className="min-h-0 flex-1 px-4 pb-4">{children}</div>
    </section>
  );
}

function Bar({ value, max, color = "var(--brand)" }: { value: number; max: number; color?: string }) {
  return (
    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-[var(--surface-hover)]">
      <div className="h-full rounded-pill" style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}

type Metric = "cost" | "tokens" | "minutes";

export default function EditrPage() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("cost");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/ops/editr", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setD(j); setErr(null);
    } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);

  const a = useMemo(() => {
    if (!d) return null;
    const u = d.usage || [], o = d.outputs || [];
    const today = daysBack(0), d7 = daysBack(6), d30 = daysBack(29), monthStart = today.slice(0, 8) + "01";
    const finals = o.filter((x) => x.kind === "final"), drafts = o.filter((x) => x.kind === "draft"), sources = o.filter((x) => x.kind === "source");
    const byAgent = new Map<string, { turns: number; written: number; tokens: number; cost: number; finalSec: number; finals: number; drafts: number }>();
    const ag = (k: string) => byAgent.get(k) || byAgent.set(k, { turns: 0, written: 0, tokens: 0, cost: 0, finalSec: 0, finals: 0, drafts: 0 }).get(k)!;
    u.forEach((r) => { const x = ag(r.agent); x.turns += r.messages; x.written += r.output; x.tokens += tok(r); x.cost += Number(r.cost_usd); });
    o.forEach((r) => { const x = ag(r.agent); if (r.kind === "final") { x.finalSec += Number(r.seconds); x.finals++; } if (r.kind === "draft") x.drafts++; });
    const byModel = new Map<string, { tokens: number; cost: number; written: number }>();
    u.forEach((r) => { const x = byModel.get(r.model) || { tokens: 0, cost: 0, written: 0 }; x.tokens += tok(r); x.cost += Number(r.cost_usd); x.written += r.output; byModel.set(r.model, x); });
    const days = [...Array(30)].map((_, i) => daysBack(29 - i));
    const series = days.map((dd) => ({
      day: dd,
      cost: sum(u.filter((r) => r.day === dd), (r) => r.cost_usd),
      tokens: sum(u.filter((r) => r.day === dd), tok),
      minutes: sum(finals.filter((r) => r.date === dd), (r) => r.seconds) / 60,
    }));
    const hosts = Array.from(new Set(u.map((r) => r.host)));
    const lastSync = u.reduce((m, r) => (r.updated_at > m ? r.updated_at : m), "");
    const spend = d.anthropicSpend || [];
    return {
      costAll: sum(u, (r) => r.cost_usd), cost30: sum(u.filter((r) => r.day >= d30), (r) => r.cost_usd),
      costMonth: sum(u.filter((r) => r.day >= monthStart), (r) => r.cost_usd),
      cost7: sum(u.filter((r) => r.day >= d7), (r) => r.cost_usd), costToday: sum(u.filter((r) => r.day === today), (r) => r.cost_usd),
      tokAll: sum(u, tok), tok7: sum(u.filter((r) => r.day >= d7), tok), written: sum(u, (r) => r.output),
      cachedShare: sum(u, (r) => r.cache_read) / Math.max(1, sum(u, tok)),
      finalSec: sum(finals, (r) => r.seconds), final7: sum(finals.filter((r) => r.date >= d7), (r) => r.seconds),
      finals: finals.length, drafts: drafts.length, sourceSec: sum(sources, (r) => r.seconds),
      byAgent: Array.from(byAgent.entries()).sort((x, y) => y[1].cost - x[1].cost),
      byModel: Array.from(byModel.entries()).sort((x, y) => y[1].cost - x[1].cost),
      series, hosts, lastSync,
      spendInr: sum(spend.filter((s) => s.currency === "INR"), (s) => s.amount), spend,
    };
  }, [d]);

  if (err) return <div className="p-6 text-sm text-accent-red">Couldn&apos;t load Editr: {err}</div>;
  if (!d || !a) return <div className="p-6 text-sm text-text-muted">Loading…</div>;

  const stats: Stat[] = [
    { key: "paid", label: "Actually paid to Anthropic", value: a.spendInr ? money(a.spendInr) : "-", icon: Wallet,
      hint: a.spend[0]?.description ? `${a.spend[0].description.split(",")[0]} (flat plan)` : "No Anthropic expense recorded" },
    { key: "value", label: "API-equivalent value", value: usd(a.costAll), icon: Coins,
      hint: `${usd(a.costMonth)} this month · ${usd(a.costToday)} today` },
    { key: "tokens", label: "Tokens processed", value: fmtN(a.tokAll), icon: Cpu,
      hint: `${fmtN(a.written)} written · ${Math.round(a.cachedShare * 100)}% cached context re-read` },
    { key: "video", label: "Video delivered", value: mins(a.finalSec), icon: Clapperboard,
      hint: `${a.finals} finals · ${a.drafts} drafts · ${mins(a.final7)} in 7 days` },
  ];

  const metricTabs: Tab<Metric>[] = [
    { value: "cost", label: "API value / day" }, { value: "tokens", label: "Tokens / day" }, { value: "minutes", label: "Video / day" },
  ];
  const max = Math.max(1e-9, ...a.series.map((s) => s[metric]));
  const fmtMetric = (v: number) => metric === "cost" ? usd(v) : metric === "tokens" ? fmtN(v) : `${v.toFixed(1)} min`;
  const maxAgentCost = Math.max(0, ...a.byAgent.map(([, x]) => x.cost));
  const tasks = [...(d.tasks || [])].sort((x, y) => Number(x.id.slice(1)) - Number(y.id.slice(1)));

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text">Editr</h1>
          <p className="text-[12.5px] text-text-muted">Video and content agents: what they cost, what they made, what they&apos;re on.</p>
        </div>
        <p className="text-[11.5px] text-text-muted">
          {a.lastSync ? `Last sync ${timeAgo(a.lastSync)}` : "No sync yet"} · machines: {a.hosts.join(", ") || "none"}
        </p>
      </header>

      <StatStrip stats={stats} />

      <OutputBreakdown outputs={d.outputs || []} tasks={d.tasks || []} usage={d.usage || []} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Last 30 days" sub="API value is list price for the same tokens; the plan is what's billed.">
          <div className="mb-3"><SegmentedTabs tabs={metricTabs} value={metric} onChange={setMetric} /></div>
          <div className="flex h-40 items-end gap-[3px]">
            {a.series.map((s) => (
              <div key={s.day} className="group relative flex h-full flex-1 flex-col justify-end" title={`${s.day}: ${fmtMetric(s[metric])}`}>
                <div className="w-full rounded-t-[3px]" style={{ height: `${(s[metric] / max) * 100}%`, minHeight: s[metric] > 0 ? 2 : 0, background: metric === "minutes" ? "var(--accent-green)" : "var(--brand)" }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-text-muted"><span>{a.series[0].day.slice(5)}</span><span>today</span></div>
        </Panel>

        <Panel title="By agent" sub="Tokens from each machine's Claude Code transcripts; video from the output ledger.">
          <table className="w-full text-[12px]">
            <thead><tr className="text-left text-[10.5px] uppercase tracking-wide text-text-muted">
              <th className="py-1 font-medium">Agent</th><th className="py-1 text-right font-medium">Turns</th>
              <th className="py-1 text-right font-medium">Written</th><th className="py-1 text-right font-medium">API value</th>
              <th className="py-1 text-right font-medium">Video</th></tr></thead>
            <tbody>
              {a.byAgent.map(([k, x]) => (
                <tr key={k} className="border-t border-[var(--border)]">
                  <td className="py-1.5"><div className="flex items-center gap-2"><span className="w-20 truncate font-medium text-text">{k}</span><Bar value={x.cost} max={maxAgentCost} /></div></td>
                  <td className="py-1.5 text-right tabular-nums">{fmtN(x.turns)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtN(x.written)}</td>
                  <td className="py-1.5 text-right tabular-nums">{usd(x.cost)}</td>
                  <td className="py-1.5 text-right tabular-nums">{x.finals ? mins(x.finalSec) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {a.byAgent.some(([, x]) => x.tokens === 0) && (
            <p className="mt-2 text-[11px] text-text-muted">An agent with no tokens hasn&apos;t synced from its machine yet.</p>
          )}
        </Panel>
      </div>

      <ComfyPanel />

      <Panel title="Tasks" sub="From tasks/*/TASK.md in bconclub/editor. Status changes are logged below.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {STATUS.map((col) => {
            const list = tasks.filter((t) => t.effective === col.key);
            return (
              <div key={col.key} className="flex min-w-0 flex-col gap-2">
                <div className="flex items-center gap-2"><StatusPill status={col.label} tone={col.tone} count={list.length} /></div>
                {list.map((t) => (
                  <div key={t.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] p-2.5">
                    <div className="flex items-center gap-1.5 text-[10.5px] text-text-muted">
                      <span className="font-semibold text-text">{t.id}</span>{t.brand && <span>· {t.brand}</span>}{t.owner && <span className="ml-auto">{t.owner}</span>}
                    </div>
                    <p className="mt-1 text-[12.5px] font-medium leading-snug text-text">{t.title}</p>
                    {t.progress_total > 0 && (
                      <div className="mt-2 flex items-center gap-2"><Bar value={t.progress_done} max={t.progress_total} color="var(--accent-green)" />
                        <span className="text-[10.5px] tabular-nums text-text-muted">{t.progress_done}/{t.progress_total}</span></div>
                    )}
                    {(() => {
                      // Only blockers that aren't done yet; a finished dependency is no longer a wait.
                      const open = (t.blocked_by || []).filter((b) => tasks.find((x) => x.id === b)?.effective !== "done");
                      const waits = [...open.map((b) => `needs ${b}`), t.waiting_on].filter(Boolean);
                      return t.effective !== "done" && waits.length
                        ? <p className="mt-1.5 text-[11px] text-accent-red">{waits.join(" · ")}</p> : null;
                    })()}
                    {t.due && <p className="mt-1 text-[10.5px] text-text-muted">due {t.due}</p>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="History" sub="Every status change, as each sync saw it.">
          <ol className="flex max-h-[420px] flex-col gap-2 overflow-auto">
            {(d.events || []).map((e) => (
              <li key={e.id} className="border-l-2 border-[var(--border)] pl-3 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-text">{e.task_id}</span>
                  <span className="text-text-muted">{e.from_status ? `${e.from_status} → ` : ""}{e.to_status}</span>
                  <span className="ml-auto text-[10.5px] text-text-muted">{timeAgo(e.at)}</span>
                </div>
                {e.note && <p className="mt-0.5 text-[11px] text-text-muted">{e.note}</p>}
              </li>
            ))}
            {!d.events?.length && <li className="text-[12px] text-text-muted">No events yet.</li>}
          </ol>
        </Panel>

        <Panel title="By model" sub="API value at list price, including cache reads and writes.">
          <ul className="flex flex-col gap-2 text-[12px]">
            {a.byModel.map(([m, x]) => (
              <li key={m}>
                <div className="flex items-center justify-between"><span className="font-medium text-text">{m}</span><span className="tabular-nums text-text">{usd(x.cost)}</span></div>
                <div className="mt-1 flex items-center gap-2"><Bar value={x.cost} max={Math.max(0, ...a.byModel.map(([, y]) => y.cost))} />
                  <span className="w-20 text-right text-[10.5px] tabular-nums text-text-muted">{fmtN(x.tokens)} tok</span></div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
