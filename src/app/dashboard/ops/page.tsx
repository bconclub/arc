"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Bell, ChevronRight, Circle, CircleCheck, Clock,
  IndianRupee, ListChecks, Plus, Search, TrendingUp,
} from "lucide-react";
import { money, moneyShort, shortAgo, avatarColor } from "@/lib/format";
import { IN_PLAY, brandIndex } from "@/lib/rollup";
import { dueLabel, receivables } from "@/lib/money";
import { Donut } from "@/components/ops/Charts";
import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { StatusPill } from "@/components/ui/StatusPill";
import { BrandMark } from "@/components/ops/BrandMark";
import { SignalDetail } from "@/components/ops/SignalDetail";
import type { Brand, Project, Payment, Proposal, OpsSignal, NowTask } from "@/types/ops";

const OWNER_NAME = "Z";

const SEV_COLOR: Record<OpsSignal["severity"], string> = {
  critical: "#e5484d",
  high: "#f59e0b",
  warn: "#f59e0b",
  info: "#6b6b6b",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function Panel({
  title, sub, href, hrefLabel = "View all", children, footer, className = "",
}: {
  title: string; sub?: string; href?: string; hrefLabel?: string;
  children: React.ReactNode; footer?: React.ReactNode; className?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col overflow-hidden rounded-panel border border-[var(--border)] bg-surface shadow-card ${className}`}>
      <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-2 pt-3.5">
        <div className="min-w-0">
          <h2 className="truncate text-[13.5px] font-semibold tracking-tight text-text">{title}</h2>
          {sub && <p className="mt-0.5 truncate text-[11px] text-text-muted">{sub}</p>}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer && <div className="shrink-0 border-t border-[var(--border)] px-4 py-2">{footer}</div>}
      {href && (
        <Link
          href={href}
          className="mx-3 mb-3 mt-2 flex shrink-0 items-center justify-center gap-1 rounded-pill bg-[var(--brand-faint)] py-2 text-[11.5px] font-medium text-[var(--brand-text)] transition-colors hover:bg-[var(--brand-soft)]"
        >
          {hrefLabel} <ChevronRight size={12} />
        </Link>
      )}
    </section>
  );
}

const emptyCls = "px-4 py-8 text-center text-[12px] text-text-muted";
const rowCls = "flex items-center gap-2 border-t border-[var(--border)] px-4 py-2 text-[12.5px] transition-colors hover:bg-[var(--glow-white)]";

function Chip({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="shrink-0 rounded-pill px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide"
      style={{ background: `${color}22`, color }}
    >
      {text}
    </span>
  );
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [signals, setSignals] = useState<OpsSignal[]>([]);
  const [nowTasks, setNowTasks] = useState<NowTask[]>([]);
  // Loaded purely so a client name can be resolved back to its brand logo.
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openSignal, setOpenSignal] = useState<OpsSignal | null>(null);

  const load = useCallback(async () => {
    const j = (url: string) => fetch(url).then((r) => r.json()).catch(() => []);
    const [pr, pay, prop, sig, now, br] = await Promise.all([
      j("/api/ops/projects"), j("/api/ops/payments"), j("/api/ops/proposals"),
      j("/api/ops/alerts"), j("/api/ops/now-tasks"), j("/api/ops/brands"),
    ]);
    setProjects(Array.isArray(pr) ? pr : []);
    setPayments(Array.isArray(pay) ? pay : []);
    setProposals(Array.isArray(prop) ? prop : []);
    setSignals(Array.isArray(sig) ? sig : []);
    setNowTasks(Array.isArray(now) ? now : []);
    setBrands(Array.isArray(br) ? br : []);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleTask(t: NowTask) {
    await fetch(`/api/ops/now-tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !t.done }),
    });
    load();
  }

  // Receivables come from lib/money, so this screen and Invoices can never
  // disagree about what is overdue.
  const r = useMemo(() => receivables(payments), [payments]);
  const brandOf = useMemo(() => brandIndex(brands), [brands]);

  const d = useMemo(() => {
    const open = signals.filter((s) => !s.seen);
    const critical = open.filter((s) => s.severity === "critical");
    const radar = open.filter((s) => s.severity !== "info").sort((a, b) => (a.ts < b.ts ? 1 : -1));

    const sevCounts = {
      critical: critical.length,
      high: open.filter((s) => s.severity === "high").length,
      warn: open.filter((s) => s.severity === "warn").length,
    };

    const inPlay = proposals.filter((p) => IN_PLAY.includes(p.status));
    const pipelineTotal = inPlay.reduce((s, p) => s + (p.amount ?? 0), 0);

    const openTasks = nowTasks.filter((t) => !t.done);
    const projectTasks = projects.flatMap((p) => (p.tasks ?? []).filter((t) => !t.done));
    const todayCount = openTasks.length + projectTasks.length;

    // Work in flight, soonest deadline first. Undated projects sort last rather
    // than jumping to the top on an empty string compare.
    const live = projects
      .filter((p) => p.status === "active" || p.status === "waiting")
      .map((p) => ({
        ...p,
        openTaskCount: (p.tasks ?? []).filter((t) => !t.done).length,
        daysLeft: dueLabel(p.end_date).days,
      }))
      .sort((a, b) => {
        if (a.daysLeft == null) return 1;
        if (b.daysLeft == null) return -1;
        return a.daysLeft - b.daysLeft;
      });

    const funnel = [
      { label: "Leads", value: proposals.filter((p) => p.status === "draft").length, color: "#8b5cf6",
        amount: proposals.filter((p) => p.status === "draft").reduce((s, p) => s + (p.amount ?? 0), 0) },
      { label: "Sent", value: proposals.filter((p) => p.status === "sent").length, color: "#3b82f6",
        amount: proposals.filter((p) => p.status === "sent").reduce((s, p) => s + (p.amount ?? 0), 0) },
      { label: "In negotiation", value: proposals.filter((p) => p.status === "discussing").length, color: "#00d4aa",
        amount: proposals.filter((p) => p.status === "discussing").reduce((s, p) => s + (p.amount ?? 0), 0) },
      { label: "Won", value: proposals.filter((p) => p.status === "won").length, color: "#cbfa0a",
        amount: proposals.filter((p) => p.status === "won").reduce((s, p) => s + (p.amount ?? 0), 0) },
    ];
    const wonCount = proposals.filter((p) => p.status === "won").length;
    const lostCount = proposals.filter((p) => p.status === "lost").length;
    const decided = wonCount + lostCount;
    const conversion = decided > 0 ? (wonCount / decided) * 100 : null;
    const wonRows = proposals.filter((p) => p.status === "won" && p.amount != null);
    const avgDeal = wonRows.length ? wonRows.reduce((s, p) => s + (p.amount ?? 0), 0) / wonRows.length : null;

    // Activity answers "what happened", Radar answers "what is still wrong".
    // Anything currently on the radar is excluded here by id, otherwise every
    // open alert renders twice, once in each panel.
    const onRadar = new Set(radar.map((s) => s.id));

    const activity = [
      ...signals.filter((s) => !onRadar.has(s.id)).map((s) => ({
        key: `s-${s.id}`, color: s.seen ? "#6b6b6b" : SEV_COLOR[s.severity],
        text: s.seen ? `Resolved: ${s.title}` : s.title, ts: s.ts, tag: "Signal",
      })),
      ...r.paidRows.map((p) => ({
        key: `p-${p.id}`, color: "#00d4aa",
        text: `Payment received: ${money(p.amount)} from ${p.client ?? "client"}`,
        ts: p.created_at, tag: "Payment",
      })),
      ...proposals.map((p) => ({
        key: `pr-${p.id}`, color: "#8b5cf6",
        text: `${p.name}: ${p.status}`, ts: p.sent ?? p.created_at, tag: "Proposal",
      })),
      ...nowTasks.filter((t) => t.done).map((t) => ({
        key: `nt-${t.id}`, color: "#00d4aa",
        text: `Done: ${t.text}`, ts: t.created_at, tag: "Task",
      })),
      ...projects.map((p) => ({
        key: `pj-${p.id}`, color: "#3b82f6",
        text: `${p.name}: ${p.progress ?? 0}% ${p.status}`, ts: p.updated_at, tag: "Project",
      })),
    ]
      .filter((a) => a.ts)
      .sort((a, b) => (a.ts! < b.ts! ? 1 : -1))
      .slice(0, 10);

    return {
      radar, critical, sevCounts, totalSignals: open.length,
      inPlay, pipelineTotal, openTasks, todayCount, live, activity,
      funnel, conversion, wonCount, lostCount, avgDeal,
      liveValue: live.reduce((s, p) => s + (p.budget ?? 0), 0),
      liveOpenTasks: live.reduce((s, p) => s + p.openTaskCount, 0),
      liveOverdue: live.filter((p) => p.daysLeft != null && p.daysLeft < 0).length,
    };
  }, [projects, proposals, signals, nowTasks, r]);

  const stats: Stat[] = [
    {
      key: "critical", label: "Critical", value: String(d.critical.length),
      hint: "Require immediate attention", icon: AlertTriangle,
      valueClass: d.critical.length > 0 ? "text-accent-red" : "text-text",
    },
    {
      key: "today", label: "Today", value: String(d.todayCount),
      hint: "Tasks and follow-ups", icon: ListChecks,
    },
    {
      key: "waiting", label: "Money waiting", value: moneyShort(r.total),
      // The total understates by exactly the unpriced count, so say so here
      // rather than leaving the reader to find out on the Invoices screen.
      hint: r.unpricedCount > 0
        ? `${r.unpaid.length} invoices, ${r.unpricedCount} with no amount`
        : `Across ${r.unpaid.length} invoice${r.unpaid.length === 1 ? "" : "s"}`,
      icon: IndianRupee,
      valueClass: r.unpricedCount > 0 ? "text-accent-orange" : "text-text",
    },
    {
      key: "pipeline", label: "Pipeline", value: moneyShort(d.pipelineTotal),
      hint: `${d.inPlay.length} qualified opportunit${d.inPlay.length === 1 ? "y" : "ies"}`,
      icon: TrendingUp,
    },
  ];

  // Money you are still owed is the brand accent, on a lime ramp that darkens as
  // the due date recedes. Red is kept strictly for overdue, so colour carries one
  // meaning: anything red is a problem, anything lime is simply outstanding.
  const ageing = [
    { label: "Overdue", value: r.ageing.overdue, color: "#e5484d" },
    { label: "Due in 7 days", value: r.ageing.soon, color: "#cbfa0a" },
    { label: "8 to 30 days", value: r.ageing.mid, color: "#a4cc08" },
    { label: "31 days or more", value: r.ageing.far, color: "#7d9c06" },
    { label: "No due date", value: r.ageing.undated, color: "#6b6b6b" },
  ].filter((s) => s.value > 0);

  const dateLine = new Date().toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

  return (
    <div className="page space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight tracking-tight text-text sm:text-[26px]">
            {greeting()}, {OWNER_NAME}.
          </h1>
          <p className="mt-0.5 text-[12.5px] text-text-muted">Mission control for today</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label className="relative hidden items-center md:flex">
            <Search size={14} className="pointer-events-none absolute left-3 text-text-muted" />
            <input
              placeholder="Search ARC"
              className="w-48 rounded-pill border border-[var(--border)] bg-surface py-1.5 pl-9 pr-3 text-[12px] text-text placeholder:text-text-muted"
            />
          </label>
          <span className="hidden rounded-pill border border-[var(--border)] bg-surface px-3 py-1.5 font-mono text-[11.5px] text-text-muted sm:inline">
            {dateLine}
          </span>
          <Link
            href="/dashboard/ops/alerts"
            aria-label={`Alerts${d.radar.length ? `: ${d.radar.length} open` : ""}`}
            className="relative rounded-pill border border-[var(--border)] bg-surface p-2 text-text-muted transition-colors hover:text-text"
          >
            <Bell size={15} />
            {d.radar.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent-red px-1 text-[9px] font-bold text-white">
                {d.radar.length}
              </span>
            )}
          </Link>
          <span className="flex items-center gap-2 rounded-pill border border-[var(--border)] bg-surface py-1 pl-1 pr-3">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-pill text-[11px] font-bold text-white"
              style={{ background: avatarColor(OWNER_NAME) }}
            >
              {OWNER_NAME.slice(0, 1)}
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-[11.5px] font-medium text-text">{OWNER_NAME}</span>
              <span className="block text-[9.5px] text-text-muted">Administrator</span>
            </span>
          </span>
        </div>
      </header>

      <StatStrip stats={stats} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel
          title="ARC Radar"
          sub="Live signal from operations"
          href="/dashboard/ops/alerts"
          hrefLabel="View all signals"
          className="lg:max-h-[420px]"
          footer={
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-text-muted">{d.totalSignals} items</span>
              <span className="flex items-center gap-3">
                {[
                  { l: "Critical", v: d.sevCounts.critical, c: "#e5484d" },
                  { l: "High", v: d.sevCounts.high, c: "#f59e0b" },
                  { l: "Warn", v: d.sevCounts.warn, c: "#eab308" },
                ].map((x) => (
                  <span key={x.l} className="flex items-center gap-1 text-text-muted">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: x.c }} />
                    {x.l} <span className="font-semibold tabular-nums text-text">{x.v}</span>
                  </span>
                ))}
              </span>
            </div>
          }
        >
          {d.radar.length === 0 ? (
            <p className={emptyCls}>{loaded ? "Radar is clear." : "Loading."}</p>
          ) : (
            <ul>
              {d.radar.map((s) => (
                <li key={s.id}>
                  <button onClick={() => setOpenSignal(s)} className={`${rowCls} w-full text-left`}>
                    <span className="mt-1 h-2 w-2 shrink-0 self-start rounded-full" style={{ background: SEV_COLOR[s.severity] }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-text">{s.title}</span>
                      {s.detail && <span className="block truncate text-[11px] text-text-muted">{s.detail}</span>}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-[10.5px] text-text-muted">{shortAgo(s.ts)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Money / Receivables"
          sub={`${r.unpaid.length} unpaid`}
          href="/dashboard/ops/money"
          hrefLabel="View all invoices"
          className="lg:max-h-[420px]"
        >
          {ageing.length === 0 ? (
            <p className={emptyCls}>{loaded ? "Nothing outstanding." : "Loading."}</p>
          ) : (
            <>
              <div className="flex items-center gap-4 px-4 pb-3">
                <Donut segments={ageing} size={104} thickness={12} center={moneyShort(r.total)} sub="Total O/S" />
                <ul className="min-w-0 flex-1 space-y-1">
                  {ageing.map((x) => (
                    <li key={x.label} className="flex items-center gap-2 text-[10.5px]">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: x.color }} />
                      <span className="min-w-0 flex-1 truncate text-text-muted">{x.label}</span>
                      <span className="shrink-0 tabular-nums text-text">{moneyShort(x.value)}</span>
                    </li>
                  ))}
                  {r.unpricedCount > 0 && (
                    <li className="pt-0.5 text-[10px] text-accent-orange">
                      + {r.unpricedCount} invoice{r.unpricedCount === 1 ? "" : "s"} with no amount
                    </li>
                  )}
                </ul>
              </div>
              <ul>
                {r.unpaid.map((p) => {
                  const due = dueLabel(p.due);
                  return (
                    <li key={p.id} className={rowCls}>
                      <BrandMark
                        name={p.client ?? "Unnamed"}
                        logoUrl={brandOf(p.client)?.logo_url}
                        color={brandOf(p.client)?.color}
                        size={24}
                        radius="rounded-md"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium text-text">{p.client ?? "Unnamed"}</span>
                        <span className="block truncate text-[9.5px] text-text-muted">{p.item ?? "No description"}</span>
                      </span>
                      <span className={`shrink-0 whitespace-nowrap text-[11.5px] tabular-nums ${p.amount == null ? "text-accent-orange" : "text-text"}`}>
                        {p.amount == null ? "No amount" : money(p.amount)}
                      </span>
                      <span className={`w-20 shrink-0 text-right text-[10px] ${due.tone === "overdue" ? "font-medium text-accent-red" : "text-text-muted"}`}>
                        {due.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Panel>

        {/* Rail: what to do now, then what just happened. */}
        <div className="flex min-w-0 flex-col gap-3 lg:row-span-2">
          <Panel title="Focus today" sub={`${d.openTasks.length} priority task${d.openTasks.length === 1 ? "" : "s"}`}>
            {d.openTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-pill border border-dashed border-[var(--border-strong)]">
                  <CircleCheck size={22} className="text-text-muted" />
                </span>
                <p className="mt-3 text-[13px] font-medium text-text">{loaded ? "All clear for now" : "Loading."}</p>
                <Link
                  href="/dashboard/ops/projects"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-pill border border-[var(--border-strong)] px-3 py-1.5 text-[11.5px] font-medium text-text transition-colors hover:bg-[var(--glow-white)]"
                >
                  <Plus size={13} /> Add a focus task
                </Link>
              </div>
            ) : (
              <ul>
                {d.openTasks.map((t) => {
                  const { tone } = dueLabel(t.due);
                  const priority = t.priority ?? (tone === "overdue" ? "high" : tone === "soon" ? "medium" : "low");
                  const pColor = priority === "high" ? "#e5484d" : priority === "medium" ? "#f59e0b" : "#6b6b6b";
                  return (
                    <li key={t.id} className={rowCls}>
                      <button
                        onClick={() => toggleTask(t)}
                        className="shrink-0 text-text-muted transition-colors hover:text-accent-green"
                        aria-label={`Mark "${t.text}" done`}
                      >
                        <Circle size={14} />
                      </button>
                      <span className="min-w-0 flex-1 truncate text-text">{t.text}</span>
                      <Chip text={priority} color={pColor} />
                      {t.estimate_minutes != null && (
                        <span className="flex shrink-0 items-center gap-0.5 whitespace-nowrap text-[10px] text-text-muted">
                          <Clock size={10} /> {t.estimate_minutes}m
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Activity feed" sub="Latest across operations" className="lg:max-h-[520px]">
            {d.activity.length === 0 ? (
              <p className={emptyCls}>{loaded ? "Nothing has happened yet." : "Loading."}</p>
            ) : (
              <ul>
                {d.activity.map((a) => (
                  <li key={a.key} className="flex items-start gap-2.5 border-t border-[var(--border)] px-4 py-2.5">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: a.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-text">{a.text}</span>
                      <span className="mt-0.5 block text-[10px] text-text-muted">{shortAgo(a.ts!)}</span>
                    </span>
                    <StatusPill status={a.tag} tone="neutral" className="shrink-0" />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel
          title="Live work"
          sub={`${d.live.length} active project${d.live.length === 1 ? "" : "s"}`}
          href="/dashboard/ops/projects"
          hrefLabel="View all projects"
          className="lg:col-span-2"
          footer={
            <div className="grid grid-cols-4 gap-2">
              {[
                { v: String(d.live.length), l: "Active projects", c: "var(--text)" },
                { v: moneyShort(d.liveValue), l: "Total value", c: "var(--text)" },
                { v: String(d.liveOpenTasks), l: "Open tasks", c: "var(--text)" },
                { v: String(d.liveOverdue), l: "Overdue", c: d.liveOverdue > 0 ? "#e5484d" : "var(--text)" },
              ].map((s) => (
                <div key={s.l} className="min-w-0">
                  <p className="truncate text-[13px] font-bold tabular-nums" style={{ color: s.c }}>{s.v}</p>
                  <p className="truncate text-[9px] text-text-muted">{s.l}</p>
                </div>
              ))}
            </div>
          }
        >
          {d.live.length === 0 ? (
            <p className={emptyCls}>{loaded ? "Nothing in flight." : "Loading."}</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 px-4 pb-2 sm:grid-cols-2 xl:grid-cols-3">
              {d.live.map((p) => {
                const late = p.daysLeft != null && p.daysLeft < 0;
                return (
                  <div key={p.id} className="rounded-soft border border-[var(--border)] p-2.5">
                    <div className="flex items-start gap-2">
                      <BrandMark
                        name={p.client ?? p.name}
                        logoUrl={brandOf(p.client)?.logo_url}
                        color={brandOf(p.client)?.color}
                        size={22}
                        radius="rounded-md"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-text">{p.name}</span>
                        <span className="block truncate text-[10.5px] text-text-muted">{p.client ?? "No client"}</span>
                      </span>
                      <StatusPill status={late ? "overdue" : p.status} className="shrink-0" />
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-[var(--surface-hover)]">
                      <div
                        className="h-full rounded-pill transition-all"
                        style={{
                          width: `${Math.max(0, Math.min(100, p.progress ?? 0))}%`,
                          background: late ? "#e5484d" : "var(--brand)",
                        }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-text-muted">
                      <span className="tabular-nums">{p.progress ?? 0}% · {p.openTaskCount} open</span>
                      <span className={late ? "font-medium text-accent-red" : ""}>
                        {p.daysLeft == null ? "No end date" : late ? `${Math.abs(p.daysLeft)}d over` : `${p.daysLeft}d left`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel
          title="Pipeline"
          sub="Proposal funnel"
          href="/dashboard/ops/proposals"
          hrefLabel="View all proposals"
          className="lg:col-span-2"
        >
          <div className="grid grid-cols-1 gap-4 px-4 pb-3 sm:grid-cols-2">
            <ul className="space-y-2">
              {d.funnel.map((s) => {
                const max = Math.max(...d.funnel.map((x) => x.value), 1);
                return (
                  <li key={s.label}>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                      <span className="min-w-0 flex-1 truncate text-text-muted">{s.label}</span>
                      <span className="font-semibold tabular-nums text-text">{s.value}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-[var(--surface-hover)]">
                        <div className="h-full rounded-pill" style={{ width: `${(s.value / max) * 100}%`, background: s.color }} />
                      </div>
                      <span className="w-14 shrink-0 text-right text-[9.5px] tabular-nums text-text-muted">
                        {moneyShort(s.amount)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="grid grid-cols-3 gap-2 self-start sm:grid-cols-1 sm:gap-3">
              <div>
                <p className="text-[9px] uppercase tracking-wide text-text-muted">Value in play</p>
                <p className="text-[16px] font-bold tabular-nums text-text">{moneyShort(d.pipelineTotal)}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wide text-text-muted">Win rate</p>
                <p className="text-[16px] font-bold tabular-nums text-text">
                  {d.conversion == null ? "Not enough data" : `${d.conversion.toFixed(0)}%`}
                </p>
                {d.lostCount === 0 && d.wonCount > 0 && (
                  <p className="text-[9px] text-text-muted">No losses logged</p>
                )}
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wide text-text-muted">Avg deal</p>
                <p className="text-[16px] font-bold tabular-nums text-text">{moneyShort(d.avgDeal)}</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {openSignal && (
        <SignalDetail
          signal={openSignal}
          onClose={() => setOpenSignal(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
