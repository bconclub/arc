"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, Cpu, ExternalLink, Loader2, MessageSquare, Monitor, Play, RotateCcw, Send, X } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { JOB_TYPES, type Machine } from "@/lib/fleet";
import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { StatusPill, type Tone } from "@/components/ui/StatusPill";

/**
 * Fleet: every machine, Claude session and render job in one place.
 *
 * Sessions report through workers/fleet/report.mjs (a Claude Code hook); render
 * workers and the hub on MAC Worker heartbeat through /api/agent/heartbeat. This page
 * reads that, queues jobs to the machine that can run them, and sends messages that
 * the hub delivers to a session (which wakes it if idle). Typing into a session
 * directly is claude.ai/code, linked in the header.
 */

type Member = {
  machine: string; agent: string; kind: string | null; project: string | null; status: string | null;
  capabilities: string[]; note: string | null; last_seen: string; stale: boolean;
  current_job: string | null; job_kind: string | null; job_stage: string | null; progress: number | null;
};
type Job = {
  id: string; kind: string; payload: Record<string, unknown>; status: string; claimed_by: string | null;
  attempts: number; max_attempts: number; error: string | null; required_capability: string | null;
  progress: number | null; stage: string | null; log_tail: string | null; created_at: string; updated_at: string;
};
type Data = { machines: Machine[]; members: Member[]; jobs: Job[] };

const MEMBER_TONE: Record<string, Tone> = {
  working: "info", needs_input: "bad", finished: "good", idle: "neutral", ended: "neutral", error: "bad",
};
const JOB_TONE: Record<string, Tone> = { queued: "neutral", running: "info", done: "good", failed: "bad", cancelled: "neutral" };
const label = (s: string | null) => (s || "unknown").replace(/_/g, " ");
const who = (agent: string) => agent.split("/").slice(1).join("/").replace(/^session:/, "") || agent;

const inputCls =
  "h-9 rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-text outline-none transition-colors placeholder:text-text-muted focus:border-[var(--brand-line)]";
const btnCls =
  "flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-soft bg-[var(--brand)] px-4 text-[12.5px] font-semibold text-[var(--brand-ink)] transition-opacity hover:opacity-90 disabled:opacity-50";
const ghostCls =
  "inline-flex items-center gap-1 rounded-soft px-2 py-1 text-[11.5px] font-medium text-text-muted transition-colors hover:bg-[var(--surface-hover)] hover:text-text disabled:opacity-50";

function Panel({ title, sub, right, children, className = "" }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex min-w-0 flex-col overflow-hidden rounded-panel border border-[var(--border)] bg-surface shadow-card ${className}`}>
      <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-2 pt-3.5">
        <div className="min-w-0">
          <h2 className="text-[13.5px] font-semibold tracking-tight text-text">{title}</h2>
          {sub && <p className="mt-0.5 text-[11px] text-text-muted">{sub}</p>}
        </div>
        {right}
      </div>
      <div className="min-h-0 flex-1 px-4 pb-4">{children}</div>
    </section>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-pill bg-[var(--surface-hover)]">
      <div className="h-full rounded-pill bg-[var(--brand)] transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export default function FleetPage() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [type, setType] = useState<string>(JOB_TYPES[0].value);
  const [target, setTarget] = useState("");
  const [brief, setBrief] = useState("");
  const [msgTo, setMsgTo] = useState<string | null>(null);
  const [msgText, setMsgText] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/ops/fleet", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setD(j); setErr(null);
    } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 10_000); return () => clearInterval(t); }, [load]);

  const act = async (key: string, body: Record<string, unknown>, ok: string) => {
    setBusy(key); setFlash(null);
    try {
      const r = await fetch("/api/ops/fleet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setFlash({ tone: "good", text: ok });
      await load();
      return true;
    } catch (e) {
      setFlash({ tone: "bad", text: (e as Error).message });
      return false;
    } finally { setBusy(null); }
  };

  const a = useMemo(() => {
    if (!d) return null;
    const byMachine = new Map<string, Member[]>();
    d.members.forEach((m) => byMachine.set(m.machine, [...(byMachine.get(m.machine) || []), m]));
    const live = d.members.filter((m) => !m.stale);
    return {
      byMachine,
      online: d.machines.filter((m) => (byMachine.get(m.slug) || []).some((x) => !x.stale)).length,
      working: live.filter((m) => m.status === "working").length,
      needs: live.filter((m) => m.status === "needs_input"),
      running: d.jobs.filter((j) => j.status === "running").length,
      queued: d.jobs.filter((j) => j.status === "queued").length,
      hubLive: (byMachine.get("mac-worker") || []).some((x) => !x.stale && x.kind === "hub"),
    };
  }, [d]);

  if (err && !d) return <div className="p-6 text-sm text-accent-red">Couldn&apos;t load Fleet: {err}</div>;
  if (!d || !a) return <div className="p-6 text-sm text-text-muted">Loading…</div>;

  const stats: Stat[] = [
    { key: "online", label: "Machines online", value: `${a.online} / ${d.machines.length}`, icon: Monitor, hint: "Reported in the last 10 minutes" },
    { key: "working", label: "Sessions working", value: String(a.working), icon: Cpu, hint: "Claude sessions mid-task" },
    { key: "needs", label: "Waiting on you", value: String(a.needs.length), icon: BellRing, hint: "Need an answer or a permission", valueClass: a.needs.length ? "text-accent-red" : undefined },
    { key: "jobs", label: "Render jobs", value: `${a.running} running`, icon: Play, hint: `${a.queued} queued` },
  ];

  const queue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await act("queue", { action: "queue", type, target: target || undefined, brief }, "Queued. The first free machine that can run it will pick it up.")) setBrief("");
  };
  const send = async (to: string) => {
    if (await act(`msg:${to}`, { action: "message", to, text: msgText }, a.hubLive ? `Sent. The hub will deliver it to ${who(to)}.` : `Saved. The hub on MAC Worker is offline; it delivers this when it's back.`)) {
      setMsgTo(null); setMsgText("");
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-text">Fleet</h1>
          <p className="mt-0.5 text-[12.5px] text-text-muted">Every machine, Claude session and render job. Refreshes every 10 seconds.</p>
        </div>
        <a href="https://claude.ai/code" target="_blank" rel="noreferrer" className={`${btnCls} self-start sm:self-auto`}>
          Open sessions in claude.ai/code <ExternalLink size={13} />
        </a>
      </header>

      <StatStrip stats={stats} />

      {flash && (
        <p role="status" className={`text-[12.5px] ${flash.tone === "good" ? "text-accent-green" : "text-accent-red"}`}>{flash.text}</p>
      )}

      {a.needs.length > 0 && (
        <Panel title="Waiting on you" sub="Answer these in claude.ai/code or on the machine">
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {a.needs.map((m) => (
              <li key={m.agent} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                <span className="min-w-0 truncate"><b className="font-semibold text-text">{who(m.agent)}</b> <span className="text-text-muted">on {m.machine} · {m.note}</span></span>
                <span className="shrink-0 text-[11px] text-text-muted">{timeAgo(m.last_seen)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        {d.machines.map((m) => {
          const members = a.byMachine.get(m.slug) || [];
          const online = members.some((x) => !x.stale);
          const last = members.reduce((t, x) => (x.last_seen > t ? x.last_seen : t), "");
          return (
            <Panel
              key={m.slug}
              title={m.name}
              sub={`${m.hardware} · ${m.role}`}
              right={<StatusPill status={online ? "online" : members.length ? `offline · ${timeAgo(last)}` : "never seen"} tone={online ? "good" : members.length ? "bad" : "neutral"} />}
            >
              {m.capabilities.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                  {m.capabilities.map((c) => (
                    <span key={c} className="rounded-pill bg-[var(--surface-hover)] px-2 py-0.5 text-[10.5px] font-medium text-text-muted">{c}</span>
                  ))}
                </div>
              )}
              {members.length === 0 ? (
                <p className="text-[12.5px] text-text-muted">Nothing has reported from this machine yet. Set up the session reporter (workers/fleet/README.md).</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {members.map((x) => (
                    <li key={x.agent} className={`rounded-soft px-2.5 py-2 ${x.stale ? "opacity-55" : ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[13px] font-medium text-text">
                          {who(x.agent)} <span className="text-[11px] font-normal text-text-muted">{x.kind}</span>
                        </span>
                        <StatusPill status={x.stale ? "silent" : label(x.status)} tone={x.stale ? "neutral" : MEMBER_TONE[x.status || ""]} />
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[11.5px] text-text-muted">
                        <span className="min-w-0 truncate">{x.note || "-"}</span>
                        <span className="shrink-0">{timeAgo(x.last_seen)}</span>
                      </div>
                      {x.current_job && x.progress != null && (
                        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-text-muted">
                          <Progress value={x.progress} /><span className="shrink-0 tabular-nums">{x.job_stage || x.job_kind} {x.progress}%</span>
                        </div>
                      )}
                      {x.kind === "session" && (
                        msgTo === x.agent ? (
                          <form onSubmit={(e) => { e.preventDefault(); send(x.agent); }} className="mt-2 flex gap-1.5">
                            <input autoFocus value={msgText} onChange={(e) => setMsgText(e.target.value)} placeholder={`Context or instructions for ${who(x.agent)}`} className={`${inputCls} min-w-0 flex-1`} />
                            <button type="submit" disabled={!msgText.trim() || busy === `msg:${x.agent}`} className={btnCls} aria-label="Send">
                              {busy === `msg:${x.agent}` ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                            </button>
                            <button type="button" onClick={() => setMsgTo(null)} className={ghostCls} aria-label="Close"><X size={13} /></button>
                          </form>
                        ) : (
                          <button onClick={() => { setMsgTo(x.agent); setMsgText(""); }} className={`${ghostCls} mt-1 -ml-2`}>
                            <MessageSquare size={12} /> Send to session
                          </button>
                        )
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          );
        })}
      </div>

      <Panel title="Jobs" sub="Queue work for whichever machine can run it, or pin it to one machine">
        <form onSubmit={queue} className="mb-4 flex flex-col gap-2 lg:flex-row">
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls} aria-label="Job type">
            {JOB_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls} aria-label="Machine">
            <option value="">Any capable machine</option>
            {d.machines.filter((m) => m.capabilities.length).map((m) => <option key={m.slug} value={m.slug}>Only {m.name}</option>)}
          </select>
          <input value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="What should it do? e.g. render BR-12 v3 at 1080x1920" className={`${inputCls} min-w-0 flex-1`} />
          <button type="submit" disabled={!brief.trim() || busy === "queue"} className={btnCls}>
            {busy === "queue" && <Loader2 size={13} className="animate-spin" />} Queue job
          </button>
        </form>

        {d.jobs.length === 0 ? (
          <p className="text-[12.5px] text-text-muted">No jobs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12.5px]">
              <thead className="text-[11px] text-text-muted">
                <tr className="border-b border-[var(--border)]">
                  <th className="py-2 pr-3 font-medium">Job</th>
                  <th className="py-2 pr-3 font-medium">Needs</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Machine</th>
                  <th className="w-40 py-2 pr-3 font-medium">Progress</th>
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {d.jobs.map((j) => {
                  const p = j.payload as { type?: string; brief?: string; to?: string; text?: string };
                  const title = j.kind === "hub_message" ? `Message → ${who(String(p.to || ""))}` : `${p.type || j.kind}`;
                  const detail = j.kind === "hub_message" ? p.text : p.brief;
                  return (
                    <tr key={j.id} className="align-top">
                      <td className="max-w-[320px] py-2 pr-3">
                        <div className="font-medium text-text">{title}</div>
                        {detail && <div className="truncate text-[11.5px] text-text-muted" title={String(detail)}>{String(detail)}</div>}
                        {j.error && <div className="truncate text-[11.5px] text-accent-red" title={j.error}>{j.error}</div>}
                      </td>
                      <td className="py-2 pr-3 text-text-muted">{j.required_capability?.replace(/^machine:/, "only ") || "any"}</td>
                      <td className="py-2 pr-3"><StatusPill status={j.status} tone={JOB_TONE[j.status]} /></td>
                      <td className="py-2 pr-3 text-text-muted">{j.claimed_by || "-"}</td>
                      <td className="py-2 pr-3">
                        {j.status === "running" ? (
                          <div className="flex flex-col gap-1"><Progress value={j.progress || 0} /><span className="text-[11px] text-text-muted">{j.stage || "starting"} · {j.progress || 0}%</span></div>
                        ) : <span className="text-text-muted">-</span>}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-text-muted">{timeAgo(j.updated_at)}</td>
                      <td className="whitespace-nowrap py-2 text-right">
                        {(j.status === "queued" || j.status === "running") && (
                          <button onClick={() => act(`cancel:${j.id}`, { action: "cancel", job_id: j.id }, "Cancelled.")} disabled={busy === `cancel:${j.id}`} className={ghostCls}><X size={12} /> Cancel</button>
                        )}
                        {(j.status === "failed" || j.status === "cancelled") && (
                          <button onClick={() => act(`retry:${j.id}`, { action: "retry", job_id: j.id }, "Back in the queue.")} disabled={busy === `retry:${j.id}`} className={ghostCls}><RotateCcw size={12} /> Retry</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
