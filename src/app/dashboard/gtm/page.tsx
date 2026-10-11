"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronDown, ChevronRight, Circle, Loader2, Pencil, Plus, ShieldCheck, Target, X } from "lucide-react";

/**
 * Go-to-market, as plans. The brief says what we sell, to whom and what a win is;
 * the rules say what runs alone and what waits for Z. Then one plan per channel,
 * each judged on signups and sales, never views. Every plan splits its steps into
 * where we stand (done, green) and what's missing (open, red), so the gap is
 * visible at a glance. Rollout is one channel at a time.
 */
type Step = { text: string; done: boolean };
type Status = "not_started" | "building" | "live" | "paused";
type Plan = {
  slug: string; name: string; ord: number; phase: string; status: Status; why: string; metric: string; target: string; current: string
  cadence: string; owner: string; steps: Step[]; tools: string[]; guardrails: string[]; next_action: string; notes: string; updated_at: string;
};
type Brief = { offer: string; buyer: string; win: string; motion: string; channels: string; truth: string; rules: string[] };

const STATUS: Record<Status, { label: string; cls: string; dot: string }> = {
  live: { label: "Live", cls: "bg-[rgba(0,212,170,0.14)] text-accent-green", dot: "bg-accent-green" },
  building: { label: "Building", cls: "bg-[rgba(245,158,11,0.14)] text-accent-orange", dot: "bg-accent-orange" },
  not_started: { label: "Not started", cls: "bg-[rgba(255,68,68,0.14)] text-accent-red", dot: "bg-accent-red" },
  paused: { label: "Paused", cls: "bg-[var(--surface-hover)] text-text-muted", dot: "bg-text-muted" },
};
const PHASES = [
  { key: "week1", label: "Week 1", what: "Brief, research, tools connected, approval rules" },
  { key: "week2", label: "Week 2", what: "Landing page and trial emails" },
  { key: "week3", label: "Week 3", what: "First channel" },
  { key: "later", label: "Then, one at a time", what: "Add a channel only when the last one runs without being asked" },
];
const BRIEF_FIELDS: { key: keyof Omit<Brief, "rules">; label: string }[] = [
  { key: "offer", label: "What we sell" }, { key: "buyer", label: "Who buys" }, { key: "win", label: "What counts as a win" },
  { key: "motion", label: "How it sells" }, { key: "channels", label: "Channels, in order" }, { key: "truth", label: "Source of truth" },
];

const input = "w-full rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] text-text outline-none placeholder:text-text-muted focus:border-[var(--brand-line)]";
const btn = "flex h-8 items-center gap-1.5 rounded-soft border border-[var(--border)] px-2.5 text-[12px] text-text hover:bg-[var(--surface-hover)] disabled:opacity-50";
const primary = "flex h-8 items-center gap-1.5 rounded-soft bg-[var(--brand)] px-3 text-[12px] font-semibold text-[var(--brand-ink)] hover:opacity-90 disabled:opacity-50";

const progress = (p: Plan) => ({ done: p.steps.filter((s) => s.done).length, total: p.steps.length });
const pct = (d: number, t: number) => (t ? Math.round((d / t) * 100) : 0);

function Bar({ done, total }: { done: number; total: number }) {
  const v = pct(done, total);
  return (
    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[rgba(255,68,68,0.18)]" title={`${done} of ${total} done`}>
      <div className="h-full rounded-full bg-accent-green transition-all" style={{ width: `${v}%` }} />
    </div>
  );
}

function StatusPill({ s }: { s: Status }) {
  return <span className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-semibold ${STATUS[s].cls}`}>{STATUS[s].label}</span>;
}

function BriefCard({ brief, onSave }: { brief: Brief | null; onSave: (b: Brief) => Promise<void> }) {
  const [edit, setEdit] = useState<Brief | null>(null);
  const [busy, setBusy] = useState(false);
  const b = brief || { offer: "", buyer: "", win: "", motion: "", channels: "", truth: "", rules: [] };
  return (
    <section className="rounded-panel border border-[var(--border)] bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-tight text-text">The brief</h2>
        {!edit && <button className={btn} onClick={() => setEdit({ ...b, rules: [...b.rules] })}><Pencil size={13} /> Edit</button>}
      </div>
      {edit ? (
        <div className="flex flex-col gap-2">
          {BRIEF_FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{f.label}</span>
              <textarea rows={2} className={input} value={edit[f.key]} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} />
            </label>
          ))}
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Approval rules, one per line</span>
            <textarea rows={5} className={input} value={edit.rules.join("\n")} onChange={(e) => setEdit({ ...edit, rules: e.target.value.split("\n") })} />
          </label>
          <div className="flex gap-2">
            <button className={primary} disabled={busy} onClick={async () => { setBusy(true); await onSave(edit); setBusy(false); setEdit(null); }}>{busy ? "Saving…" : "Save brief"}</button>
            <button className={btn} onClick={() => setEdit(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 lg:grid-cols-[1.6fr_1fr]">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BRIEF_FIELDS.map((f) => (
              <div key={f.key}>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{f.label}</dt>
                <dd className={`mt-0.5 text-[13px] leading-snug ${b[f.key] ? "text-text" : "text-accent-red"}`}>{b[f.key] || "Missing"}</dd>
              </div>
            ))}
          </dl>
          <div className="rounded-lg bg-[var(--surface-hover)] p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted"><ShieldCheck size={13} /> Approval rules</p>
            <ul className="flex flex-col gap-1.5">
              {b.rules.map((r) => <li key={r} className="text-[12.5px] leading-snug text-text">{r}</li>)}
              {!b.rules.length && <li className="text-[12.5px] text-accent-red">No rules written yet</li>}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function PlanCard({ p, open, onToggle, onPatch }: { p: Plan; open: boolean; onToggle: () => void; onPatch: (patch: Partial<Plan>) => Promise<void> }) {
  const [edit, setEdit] = useState<Partial<Plan> | null>(null);
  const [newStep, setNewStep] = useState("");
  const { done, total } = progress(p);
  const have = p.steps.map((s, i) => ({ ...s, i })).filter((s) => s.done);
  const missing = p.steps.map((s, i) => ({ ...s, i })).filter((s) => !s.done);
  const toggle = (i: number) => onPatch({ steps: p.steps.map((s, j) => (j === i ? { ...s, done: !s.done } : s)) });

  return (
    <section id={p.slug} className="scroll-mt-4 overflow-hidden rounded-panel border border-[var(--border)] bg-surface">
      <button onClick={onToggle} className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-left hover:bg-[var(--surface-hover)]">
        {open ? <ChevronDown size={16} className="text-text-muted" /> : <ChevronRight size={16} className="text-text-muted" />}
        <span className="text-[11px] font-semibold tabular-nums text-text-muted">{p.ord}</span>
        <span className="min-w-0 flex-1 text-[15px] font-semibold tracking-tight text-text">{p.name}</span>
        <StatusPill s={p.status} />
        <span className="flex w-full items-center gap-2 sm:w-56">
          <Bar done={done} total={total} />
          <span className="w-10 text-right text-[11.5px] tabular-nums text-text-muted">{done}/{total}</span>
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t border-[var(--border)] px-4 py-4">
          <p className="text-[13px] leading-relaxed text-text">{p.why}</p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            {[["Judged on", p.metric], ["Target", p.target], ["Now", p.current || "Not measured yet"], ["Cadence · owner", [p.cadence, p.owner].filter(Boolean).join(" · ")]].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-[var(--surface-hover)] px-3 py-2">
                <p className="text-[10.5px] uppercase tracking-wide text-text-muted">{l}</p>
                <p className={`text-[13px] font-medium ${l === "Now" && !p.current ? "text-accent-red" : "text-text"}`}>{v || "-"}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-[rgba(0,212,170,0.35)] bg-[rgba(0,212,170,0.06)] p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-accent-green"><Check size={14} /> Where we stand · {have.length}</p>
              <ul className="flex flex-col gap-1.5">
                {have.map((s) => (
                  <li key={s.i} className="flex items-start gap-2 text-[13px] text-text">
                    <button aria-label="Mark as missing" onClick={() => toggle(s.i)} className="mt-0.5 shrink-0 text-accent-green hover:opacity-70"><Check size={15} /></button>
                    <span>{s.text}</span>
                  </li>
                ))}
                {!have.length && <li className="text-[12.5px] text-text-muted">Nothing in place yet.</li>}
              </ul>
            </div>
            <div className="rounded-lg border border-[rgba(255,68,68,0.35)] bg-[rgba(255,68,68,0.06)] p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-accent-red"><X size={14} /> What&apos;s missing · {missing.length}</p>
              <ul className="flex flex-col gap-1.5">
                {missing.map((s) => (
                  <li key={s.i} className="flex items-start gap-2 text-[13px] text-text">
                    <button aria-label="Mark as done" onClick={() => toggle(s.i)} className="mt-0.5 shrink-0 text-accent-red hover:text-accent-green"><Circle size={15} /></button>
                    <span>{s.text}</span>
                  </li>
                ))}
                {!missing.length && <li className="text-[12.5px] text-accent-green">Nothing missing. Run it and watch the number.</li>}
              </ul>
              <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newStep.trim()) { onPatch({ steps: [...p.steps, { text: newStep.trim(), done: false }] }); setNewStep(""); } }}>
                <input className={input + " h-8 py-1"} placeholder="Add a missing piece" value={newStep} onChange={(e) => setNewStep(e.target.value)} aria-label="Add a missing piece" />
                <button className={btn} aria-label="Add"><Plus size={13} /></button>
              </form>
            </div>
          </div>

          {p.next_action && (
            <p className="flex items-start gap-2 rounded-lg bg-[var(--brand-soft)] px-3 py-2 text-[13px] text-[var(--brand-text)]">
              <ArrowRight size={15} className="mt-0.5 shrink-0" /><span><span className="font-semibold">Next: </span>{p.next_action}</span>
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">Tools</p>
              <div className="flex flex-wrap gap-1.5">{p.tools.map((t) => <span key={t} className="rounded-pill bg-[var(--surface-hover)] px-2 py-0.5 text-[11.5px] text-text">{t}</span>)}</div>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">Guardrails</p>
              <ul className="flex flex-col gap-1">{p.guardrails.map((g) => <li key={g} className="flex gap-1.5 text-[12px] text-text"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-text-muted" />{g}</li>)}</ul>
            </div>
          </div>

          {edit ? (
            <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-[11px] text-text-muted">Status
                  <select className={input} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Status })}>
                    {(Object.keys(STATUS) as Status[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-text-muted">Now (current number)
                  <input className={input} value={edit.current} onChange={(e) => setEdit({ ...edit, current: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-text-muted">Target
                  <input className={input} value={edit.target} onChange={(e) => setEdit({ ...edit, target: e.target.value })} />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-[11px] text-text-muted">Next action
                <input className={input} value={edit.next_action} onChange={(e) => setEdit({ ...edit, next_action: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-text-muted">Notes
                <textarea rows={3} className={input} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
              </label>
              <div className="flex gap-2">
                <button className={primary} onClick={async () => { await onPatch(edit); setEdit(null); }}>Save</button>
                <button className={btn} onClick={() => setEdit(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button className={btn} onClick={() => setEdit({ status: p.status, current: p.current, target: p.target, next_action: p.next_action, notes: p.notes })}><Pencil size={13} /> Update status and numbers</button>
              {p.notes && <p className="text-[12px] text-text-muted">{p.notes}</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function GtmPage() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const r = await fetch("/api/gtm/plans", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || "GTM could not load.");
    setPlans(j.plans); setBrief(j.brief); setErr("");
  }, []);
  useEffect(() => { load(); }, [load]);

  async function patch(slug: string, body: Partial<Plan>) {
    setPlans((ps) => ps?.map((p) => (p.slug === slug ? { ...p, ...body } as Plan : p)) ?? null);
    const r = await fetch(`/api/gtm/plans/${slug}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) { setErr("Couldn't save that change."); load(); }
  }
  async function saveBrief(b: Brief) {
    const r = await fetch("/api/gtm/plans", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setBrief(j.brief); else setErr(j.error || "Couldn't save the brief.");
  }

  const totals = useMemo(() => {
    const all = (plans || []).flatMap((p) => p.steps);
    return { done: all.filter((s) => s.done).length, total: all.length };
  }, [plans]);
  // Open the plan, then scroll once it has rendered open (two frames, so the height is final).
  const go = (slug: string) => {
    setOpen((o) => ({ ...o, [slug]: true }));
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(slug)?.scrollIntoView({ behavior: "smooth", block: "start" })));
  };

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4 p-4 lg:p-6">
      <header className="flex items-start gap-2.5">
        <Target size={18} className="mt-1 text-text-muted" />
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text">Go-to-market</h1>
          <p className="max-w-[80ch] text-[12.5px] text-text-muted">
            One plan per channel. Look at what&apos;s working before writing anything, judge every channel on signups and sales (never views),
            and nothing gets posted, sent or paid for until Z says yes.
          </p>
        </div>
      </header>

      {err && <p className="text-[13px] text-accent-red">{err}</p>}
      {!plans ? (
        <div className="flex h-60 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={18} /></div>
      ) : (
        <>
          {/* Where we stand, at a glance: one row per plan */}
          <section className="rounded-panel border border-[var(--border)] bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight text-text">Where we stand</h2>
                <p className="text-[12px] text-text-muted">
                  <span className="font-semibold text-accent-green">{totals.done} in place</span> · <span className="font-semibold text-accent-red">{totals.total - totals.done} missing</span> · {pct(totals.done, totals.total)}% of the system built
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-[11.5px] text-text-muted">
                {(Object.keys(STATUS) as Status[]).map((s) => (
                  <span key={s} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${STATUS[s].dot}`} />{STATUS[s].label} {plans.filter((p) => p.status === s).length}</span>
                ))}
              </div>
            </div>
            <ul className="flex flex-col">
              {plans.map((p) => {
                const { done, total } = progress(p);
                const firstGap = p.steps.find((s) => !s.done);
                return (
                  <li key={p.slug}>
                    <button onClick={() => go(p.slug)} className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-t border-[var(--border)] py-2.5 text-left first:border-t-0 hover:bg-[var(--surface-hover)] sm:grid-cols-[minmax(0,220px)_90px_minmax(0,160px)_minmax(0,1fr)]">
                      <span className="truncate text-[13.5px] font-medium text-text">{p.name}</span>
                      <span className="justify-self-end sm:justify-self-start"><StatusPill s={p.status} /></span>
                      <span className="flex items-center gap-2"><Bar done={done} total={total} /><span className="w-9 text-right text-[11px] tabular-nums text-text-muted">{done}/{total}</span></span>
                      <span className="col-span-2 truncate text-[12px] sm:col-span-1">
                        {firstGap ? <><span className="font-semibold text-accent-red">Missing: </span><span className="text-text-muted">{firstGap.text}</span></> : <span className="text-accent-green">Complete</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Rollout: one channel at a time */}
          <section className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {PHASES.map((ph) => {
              const inPhase = plans.filter((p) => p.phase === ph.key);
              return (
                <div key={ph.key} className="rounded-panel border border-[var(--border)] bg-surface p-3">
                  <p className="text-[13px] font-semibold text-text">{ph.label}</p>
                  <p className="text-[11.5px] text-text-muted">{ph.what}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {inPhase.map((p) => (
                      <button key={p.slug} onClick={() => go(p.slug)} className="flex items-center gap-1.5 rounded-pill border border-[var(--border)] px-2 py-0.5 text-[11.5px] text-text hover:border-[var(--brand-line)]">
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS[p.status].dot}`} />{p.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>

          <BriefCard brief={brief} onSave={saveBrief} />

          <div className="flex flex-col gap-2">
            {plans.map((p) => (
              <PlanCard key={p.slug} p={p} open={!!open[p.slug]} onToggle={() => setOpen((o) => ({ ...o, [p.slug]: !o[p.slug] }))} onPatch={(b) => patch(p.slug, b)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
