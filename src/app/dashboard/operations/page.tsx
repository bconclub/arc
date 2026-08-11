"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Settings2, ChevronRight, AlertTriangle, Megaphone, CalendarClock, Wallet,
} from "lucide-react";
import { money, moneyShort, initials, avatarColor } from "@/lib/format";
import { UNPAID, IN_PLAY } from "@/lib/rollup";
import { Timeline, type TimelineRow } from "@/components/ops/Timeline";
import type { Project, Payment, Proposal, OpsSignal } from "@/types/ops";

const DAY = 86_400_000;

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  const t = new Date(d.length <= 10 ? d + "T00:00:00" : d).getTime();
  if (!Number.isFinite(t)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((t - today.getTime()) / DAY);
}

function Panel({ title, sub, href, children, className = "" }: {
  title: string; sub?: string; href?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-[var(--border)] bg-surface ${className}`}>
      <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-3.5">
        <div className="min-w-0">
          <h2 className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-text">{title}</h2>
          {sub && <p className="mt-0.5 text-[10.5px] text-text-muted">{sub}</p>}
        </div>
        {href && (
          <Link href={href} className="flex shrink-0 items-center gap-0.5 text-[10.5px] text-text-muted hover:text-text">
            View all <ChevronRight size={12} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default function OperationsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [signals, setSignals] = useState<OpsSignal[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const j = (url: string) => fetch(url).then((r) => r.json()).catch(() => []);
    const [pr, pay, prop, sig] = await Promise.all([
      j("/api/ops/projects"), j("/api/ops/payments"), j("/api/ops/proposals"), j("/api/ops/alerts"),
    ]);
    setProjects(Array.isArray(pr) ? pr : []);
    setPayments(Array.isArray(pay) ? pay : []);
    setProposals(Array.isArray(prop) ? prop : []);
    setSignals(Array.isArray(sig) ? sig : []);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const d = useMemo(() => {
    const rows: TimelineRow[] = projects
      .filter((p) => p.status === "active" || p.status === "waiting")
      .map((p) => ({
        ...p,
        daysLeft: daysUntil(p.end_date),
        openTasks: (p.tasks ?? []).filter((t) => !t.done).length,
      }))
      .sort((a, b) => {
        if (a.daysLeft == null) return 1;
        if (b.daysLeft == null) return -1;
        return a.daysLeft - b.daysLeft;
      });

    const overdue = rows.filter((r) => r.daysLeft != null && r.daysLeft < 0);
    const contracted = rows.reduce((s, r) => s + (r.budget ?? 0), 0);
    const openTasks = rows.reduce((s, r) => s + r.openTasks, 0);
    const avgProgress = rows.length
      ? Math.round(rows.reduce((s, r) => s + (r.progress ?? 0), 0) / rows.length)
      : 0;

    const inPlay = proposals.filter((p) => IN_PLAY.includes(p.status));
    const funnel = [
      { label: "Leads", value: proposals.filter((p) => p.status === "draft").length, color: "#8b5cf6" },
      { label: "Sent", value: proposals.filter((p) => p.status === "sent").length, color: "#3b82f6" },
      { label: "Negotiating", value: proposals.filter((p) => p.status === "discussing").length, color: "#00d4aa" },
      { label: "Won", value: proposals.filter((p) => p.status === "won").length, color: "#f59e0b" },
    ];
    const won = proposals.filter((p) => p.status === "won").length;
    const lost = proposals.filter((p) => p.status === "lost").length;

    // Everything landing in the next 7 days, from every source, in one list.
    const week: { key: string; label: string; sub: string; days: number; kind: "task" | "money" | "project" }[] = [];
    for (const p of projects) {
      (p.tasks ?? []).forEach((t, i) => {
        const dl = daysUntil(t.due);
        if (!t.done && dl != null && dl <= 7) {
          week.push({ key: `t-${p.id}-${i}`, label: t.text, sub: p.name, days: dl, kind: "task" });
        }
      });
      const dl = daysUntil(p.end_date);
      if ((p.status === "active" || p.status === "waiting") && dl != null && dl <= 7) {
        week.push({ key: `p-${p.id}`, label: `${p.name} due`, sub: p.client ?? "-", days: dl, kind: "project" });
      }
    }
    for (const p of payments.filter((x) => UNPAID.includes(x.status))) {
      const dl = daysUntil(p.due);
      if (dl != null && dl <= 7) {
        week.push({ key: `m-${p.id}`, label: `${money(p.amount)} from ${p.client ?? "-"}`, sub: p.item ?? "-", days: dl, kind: "money" });
      }
    }
    week.sort((a, b) => a.days - b.days);

    const blocked = projects.filter((p) => p.status === "waiting");

    return {
      rows, overdue, contracted, openTasks, avgProgress,
      inPlay, funnel, won, lost,
      pipelineValue: inPlay.reduce((s, p) => s + (p.amount ?? 0), 0),
      week, blocked,
      criticalSignals: signals.filter((s) => !s.seen && s.severity === "critical"),
    };
  }, [projects, payments, proposals, signals]);

  const stats = [
    { label: "In flight", value: String(d.rows.length), sub: "active + waiting", color: "#8b5cf6" },
    { label: "Behind", value: String(d.overdue.length), sub: "past their end date", color: "#e5484d" },
    { label: "Contracted", value: moneyShort(d.contracted), sub: "value in flight", color: "#00d4aa" },
    { label: "Avg progress", value: `${d.avgProgress}%`, sub: `${d.openTasks} tasks open`, color: "#f59e0b" },
    { label: "Pipeline", value: moneyShort(d.pipelineValue), sub: `${d.inPlay.length} in play`, color: "#3b82f6" },
  ];

  return (
    <div className="space-y-3 px-4 pb-24 pt-4 sm:px-5 lg:px-6">
      <header className="flex items-center gap-2.5">
        <Settings2 size={19} className="text-text-muted" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">Operations</h1>
          <p className="mt-0.5 text-[12.5px] text-text-muted">
            What&apos;s running, what&apos;s late, and what lands this week
          </p>
        </div>
      </header>

      {/* ── Summary ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-[var(--border)] bg-surface p-3">
            <p className="text-[18px] font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
            <p className="mt-0.5 text-[11px] font-medium text-text">{s.label}</p>
            <p className="text-[9.5px] text-text-muted">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Timeline ── */}
      <Panel title="Delivery timeline" sub="Every project in flight · red line is today" href="/dashboard/ops/projects">
        {!loaded ? (
          <p className="px-4 py-10 text-center text-[12px] text-text-muted">Loading…</p>
        ) : (
          <div className="px-4 pb-4">
            <Timeline rows={d.rows} />
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* ── This week ── */}
        <Panel title="Lands this week" sub={`${d.week.length} item${d.week.length === 1 ? "" : "s"} in the next 7 days`}>
          <ul className="max-h-[320px] overflow-y-auto">
            {d.week.length === 0 ? (
              <li className="px-4 py-8 text-center text-[12px] text-text-muted">
                {loaded ? "Nothing due in the next 7 days." : "Loading…"}
              </li>
            ) : (
              d.week.map((w) => (
                <li key={w.key} className="flex items-center gap-2 border-t border-[var(--border)] px-4 py-2">
                  <span className="shrink-0">
                    {w.kind === "money" ? <Wallet size={12} className="text-accent-green" />
                      : w.kind === "project" ? <CalendarClock size={12} className="text-[#8b5cf6]" />
                      : <AlertTriangle size={12} className="text-text-muted" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] text-text">{w.label}</span>
                    <span className="block truncate text-[9.5px] text-text-muted">{w.sub}</span>
                  </span>
                  <span
                    className={`shrink-0 whitespace-nowrap text-[10px] ${
                      w.days < 0 ? "font-medium text-accent-red" : w.days === 0 ? "font-medium text-accent-orange" : "text-text-muted"
                    }`}
                  >
                    {w.days < 0 ? `${Math.abs(w.days)}d late` : w.days === 0 ? "today" : `${w.days}d`}
                  </span>
                </li>
              ))
            )}
          </ul>
        </Panel>

        {/* ── Blocked ── */}
        <Panel title="Waiting on someone" sub="Blocked, not moving" href="/dashboard/ops/projects">
          <ul className="max-h-[320px] overflow-y-auto">
            {d.blocked.length === 0 ? (
              <li className="px-4 py-8 text-center text-[12px] text-text-muted">
                {loaded ? "Nothing blocked." : "Loading…"}
              </li>
            ) : (
              d.blocked.map((p) => (
                <li key={p.id} className="flex items-center gap-2 border-t border-[var(--border)] px-4 py-2">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
                    style={{ background: avatarColor(p.client) }}
                  >
                    {initials(p.client)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-text">{p.name}</span>
                    <span className="block truncate text-[9.5px] text-text-muted">{p.next ?? "no next step recorded"}</span>
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-text-muted">{p.progress ?? 0}%</span>
                </li>
              ))
            )}
          </ul>
        </Panel>

        {/* ── Pipeline ── */}
        <Panel title="Pipeline building" sub="Proposal funnel" href="/dashboard/ops/proposals">
          <div className="px-4 pb-4">
            {/* Proportional bars, not a funnel shape. Won can exceed Sent here
                because historical wins predate the current pipeline. A funnel
                polygon renders that as a bowtie and reads as broken. */}
            <ul className="space-y-1.5">
              {d.funnel.map((s) => {
                const max = Math.max(...d.funnel.map((x) => x.value), 1);
                return (
                  <li key={s.label}>
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-text">{s.label}</span>
                      <span className="text-[12px] font-semibold tabular-nums text-text">{s.value}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(s.value / max) * 100}%`, background: s.color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-2">
              <div>
                <p className="text-[8.5px] uppercase tracking-wide text-text-muted">Value in play</p>
                <p className="text-[15px] font-bold tabular-nums text-text">{moneyShort(d.pipelineValue)}</p>
              </div>
              <div>
                <p className="text-[8.5px] uppercase tracking-wide text-text-muted">Won / lost</p>
                <p className="text-[15px] font-bold tabular-nums text-text">
                  {d.won} / {d.lost}
                  {d.lost === 0 && d.won > 0 && (
                    <span className="ml-1 text-[9px] font-normal text-text-muted">no losses logged</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* ── Ads: awaiting the Meta/Google connectors ── */}
      <Panel title="Ads running" sub="Live campaigns & spend" href="/dashboard/admin">
        <div className="px-4 py-8 text-center">
          <Megaphone size={20} className="mx-auto mb-2 text-text-muted" />
          <p className="text-[12px] text-text-muted">
            No ad data yet. Meta and Google Ads connectors aren&apos;t built.
          </p>
          <Link href="/dashboard/admin" className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-accent-red hover:underline">
            Set up connectors <ChevronRight size={12} />
          </Link>
        </div>
      </Panel>
    </div>
  );
}
