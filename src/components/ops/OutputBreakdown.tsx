"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { StatusPill, type Tone } from "@/components/ui/StatusPill";

/**
 * Editr output breakdown: which agent made what. Per agent, how many finals, drafts and sources
 * and how many minutes each; brand by agent; then every file, grouped agent > task.
 * Everything comes from the output ledger (editr_outputs) the machines sync; cost is the agent's
 * API-equivalent token value from editr_usage, so an agent that hasn't synced usage shows "-".
 */

type Output = { id: string; date: string; task: string; agent: string; kind: string; file: string; seconds: number; width: number | null; height: number | null; brand: string | null };
type Task = { id: string; title: string; brand: string | null; effective: string };
type Usage = { agent: string; cost_usd: number };

const KINDS = ["final", "draft", "source"] as const;
type Kind = (typeof KINDS)[number];
const KIND_TONE: Record<string, Tone> = { final: "good", draft: "neutral", source: "info" };
const TASK_TONE: Record<string, Tone> = { done: "good", review: "warn", doing: "info", blocked: "bad", todo: "neutral" };

const mins = (s: number) => (s >= 60 ? `${(s / 60).toFixed(1)} min` : `${Math.round(s)}s`);
const usd = (n: number) => `$${n >= 1000 ? Math.round(n).toLocaleString("en-US") : n.toFixed(2)}`;
const name = (f: string) => f.split(/[\\/]/).pop()!.replace(/\.(mp4|mov|webm|mkv)$/i, "");
const shape = (w: number | null, h: number | null) => {
  if (!w || !h) return "";
  const r = w / h;
  return Math.abs(r - 16 / 9) < 0.05 ? "16:9" : Math.abs(r - 9 / 16) < 0.05 ? "9:16" : Math.abs(r - 1) < 0.05 ? "1:1" : `${w}×${h}`;
};

type Tally = Record<Kind, { n: number; sec: number }>;
const tally = (rows: Output[]): Tally => {
  const t = { final: { n: 0, sec: 0 }, draft: { n: 0, sec: 0 }, source: { n: 0, sec: 0 } } as Tally;
  rows.forEach((r) => { const k = t[r.kind as Kind]; if (k) { k.n++; k.sec += Number(r.seconds) || 0; } });
  return t;
};

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`h-7 rounded-pill border px-3 text-[11.5px] transition-colors ${on ? "border-[var(--brand-line)] bg-[var(--brand)] text-[var(--brand-ink)]" : "border-[var(--border)] text-text-muted hover:text-text"}`}>
      {children}
    </button>
  );
}

export function OutputBreakdown({ outputs, tasks, usage }: { outputs: Output[]; tasks: Task[]; usage: Usage[] }) {
  const [agent, setAgent] = useState<string>("all");
  const [kind, setKind] = useState<Kind | "all">("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const agents = useMemo(() => Array.from(new Set(outputs.map((o) => o.agent))).sort(), [outputs]);
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const costBy = useMemo(() => {
    const m = new Map<string, number>();
    usage.forEach((u) => m.set(u.agent, (m.get(u.agent) || 0) + Number(u.cost_usd)));
    return m;
  }, [usage]);

  const rows = useMemo(
    () => outputs.filter((o) => (agent === "all" || o.agent === agent) && (kind === "all" || o.kind === kind)),
    [outputs, agent, kind],
  );

  // Per-agent summary ignores the kind filter: the card is the agent's whole picture.
  const perAgent = useMemo(() => agents.filter((a) => agent === "all" || a === agent).map((a) => {
    const mine = outputs.filter((o) => o.agent === a);
    const t = tally(mine);
    return {
      agent: a, t, cost: costBy.get(a),
      tasks: new Set(mine.map((o) => o.task)).size,
      brands: Array.from(new Set(mine.map((o) => o.brand || "-"))),
    };
  }), [agents, agent, outputs, costBy]);

  const brands = useMemo(() => Array.from(new Set(rows.map((o) => o.brand || "-"))).sort(), [rows]);
  const matrixAgents = agent === "all" ? agents : [agent];
  const cell = (b: string, a: string) => rows.filter((o) => (o.brand || "-") === b && o.agent === a);

  // agent > task > files, newest task first.
  const groups = useMemo(() => {
    const byAgent = new Map<string, Map<string, Output[]>>();
    rows.forEach((o) => {
      const tasksOf = byAgent.get(o.agent) || byAgent.set(o.agent, new Map()).get(o.agent)!;
      (tasksOf.get(o.task) || tasksOf.set(o.task, []).get(o.task)!).push(o);
    });
    return Array.from(byAgent.entries()).sort(([x], [y]) => x.localeCompare(y)).map(([a, m]) => ({
      agent: a,
      tasks: Array.from(m.entries())
        .map(([task, files]) => ({ task, files: files.sort((x, y) => KINDS.indexOf(x.kind as Kind) - KINDS.indexOf(y.kind as Kind) || y.date.localeCompare(x.date)) }))
        .sort((x, y) => Math.max(...y.files.map((f) => +new Date(f.date))) - Math.max(...x.files.map((f) => +new Date(f.date)))),
    }));
  }, [rows]);

  const total = tally(rows);

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-panel border border-[var(--border)] bg-surface shadow-card">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-3.5">
        <div>
          <h2 className="text-[13.5px] font-semibold tracking-tight text-text">Output breakdown</h2>
          <p className="mt-0.5 text-[11px] text-text-muted">
            Which agent made what. Finals are delivered videos, drafts are earlier versions, sources are raw footage brought in.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap justify-end gap-1.5">
            <Chip on={agent === "all"} onClick={() => setAgent("all")}>All agents</Chip>
            {agents.map((a) => <Chip key={a} on={agent === a} onClick={() => setAgent(a)}>{a}</Chip>)}
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            <Chip on={kind === "all"} onClick={() => setKind("all")}>All files</Chip>
            {KINDS.map((k) => <Chip key={k} on={kind === k} onClick={() => setKind(k)}>{k}s</Chip>)}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-4 pb-4">
        {/* One card per agent */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {perAgent.map((p) => {
            const delivered = p.t.final.sec / 60;
            return (
              <div key={p.agent} className="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-semibold text-text">{p.agent}</span>
                  <span className="text-[11px] text-text-muted">{p.tasks} task{p.tasks === 1 ? "" : "s"} · {p.brands.join(", ")}</span>
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {KINDS.map((k) => (
                    <div key={k}>
                      <p className="text-[10.5px] uppercase tracking-wide text-text-muted">{k}s</p>
                      <p className="text-[17px] font-semibold tabular-nums text-text">{p.t[k].n}</p>
                      <p className="text-[11px] tabular-nums text-text-muted">{p.t[k].n ? mins(p.t[k].sec) : "-"}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2.5 border-t border-[var(--border)] pt-2 text-[11px] text-text-muted">
                  API value {p.cost != null ? <span className="text-text">{usd(p.cost)}</span> : "- (no token sync)"}
                  {p.cost != null && delivered > 0 && <> · <span className="text-text">{usd(p.cost / delivered)}</span> per delivered minute</>}
                </p>
              </div>
            );
          })}
        </div>

        {/* Brand by agent */}
        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Brand by agent{kind !== "all" ? ` · ${kind}s only` : ""}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead><tr className="text-left text-[10.5px] uppercase tracking-wide text-text-muted">
                <th className="py-1 pr-3 font-medium">Brand</th>
                {matrixAgents.map((a) => <th key={a} className="py-1 pr-3 text-right font-medium">{a}</th>)}
                <th className="py-1 text-right font-medium">Total</th>
              </tr></thead>
              <tbody>
                {brands.map((b) => {
                  const all = rows.filter((o) => (o.brand || "-") === b);
                  return (
                    <tr key={b} className="border-t border-[var(--border)]">
                      <td className="py-1.5 pr-3 font-medium text-text">{b}</td>
                      {matrixAgents.map((a) => {
                        const c = cell(b, a), sec = c.reduce((s, o) => s + Number(o.seconds), 0);
                        return <td key={a} className="py-1.5 pr-3 text-right tabular-nums">{c.length ? <>{c.length} <span className="text-text-muted">· {mins(sec)}</span></> : <span className="text-text-muted">-</span>}</td>;
                      })}
                      <td className="py-1.5 text-right tabular-nums text-text">{all.length} <span className="text-text-muted">· {mins(all.reduce((s, o) => s + Number(o.seconds), 0))}</span></td>
                    </tr>
                  );
                })}
                <tr className="border-t border-[var(--border)] font-semibold">
                  <td className="py-1.5 pr-3 text-text">Total</td>
                  {matrixAgents.map((a) => {
                    const c = rows.filter((o) => o.agent === a);
                    return <td key={a} className="py-1.5 pr-3 text-right tabular-nums text-text">{c.length} <span className="font-normal text-text-muted">· {mins(c.reduce((s, o) => s + Number(o.seconds), 0))}</span></td>;
                  })}
                  <td className="py-1.5 text-right tabular-nums text-text">{rows.length} <span className="font-normal text-text-muted">· {mins(rows.reduce((s, o) => s + Number(o.seconds), 0))}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-[11px] text-text-muted">
            Counts are files · minutes. In view: {total.final.n} finals ({mins(total.final.sec)}), {total.draft.n} drafts ({mins(total.draft.sec)}), {total.source.n} sources ({mins(total.source.sec)}).
          </p>
        </div>

        {/* Every file, agent > task */}
        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">Every output, by agent and task</p>
          <div className="flex flex-col gap-4">
            {groups.map((g) => (
              <div key={g.agent}>
                <p className="mb-1.5 text-[12.5px] font-semibold text-text">{g.agent}</p>
                <div className="flex flex-col gap-1.5">
                  {g.tasks.map(({ task, files }) => {
                    const t = taskById.get(task), k = `${g.agent}|${task}`, isOpen = open[k] ?? false, s = tally(files);
                    return (
                      <div key={k} className="rounded-lg border border-[var(--border)]">
                        <button onClick={() => setOpen((o) => ({ ...o, [k]: !isOpen }))}
                          className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-left hover:bg-[var(--surface-hover)]">
                          {isOpen ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
                          {t?.title && <span className="text-[11px] font-semibold text-text-muted">{task}</span>}
                          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-text">{t?.title || task}</span>
                          {(t?.brand || files[0].brand) && <span className="text-[11px] text-text-muted">{t?.brand || files[0].brand}</span>}
                          {t && <StatusPill status={t.effective} tone={TASK_TONE[t.effective]} />}
                          <span className="text-[11px] tabular-nums text-text-muted">
                            {KINDS.filter((x) => s[x].n).map((x) => `${s[x].n} ${x}${s[x].n === 1 ? "" : "s"} (${mins(s[x].sec)})`).join(" · ")}
                          </span>
                        </button>
                        {isOpen && (
                          <ul className="border-t border-[var(--border)] px-3 py-1 text-[12px]">
                            {files.map((f) => (
                              <li key={f.id} className="flex items-center gap-2 py-1">
                                <StatusPill status={f.kind} tone={KIND_TONE[f.kind]} />
                                {f.file.startsWith("http")
                                  ? <a href={f.file} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-text underline-offset-2 hover:underline" title={f.file}>{name(f.file)}</a>
                                  : <span className="min-w-0 flex-1 truncate text-text" title={f.file}>{name(f.file)}</span>}
                                <span className="w-10 text-right text-[10.5px] text-text-muted">{shape(f.width, f.height)}</span>
                                <span className="w-14 text-right tabular-nums text-text">{mins(Number(f.seconds))}</span>
                                <span className="w-12 text-right text-[10.5px] tabular-nums text-text-muted">{f.date.slice(5)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {!groups.length && <p className="text-[12px] text-text-muted">No outputs match.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
