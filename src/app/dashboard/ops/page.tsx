"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ListChecks, Wallet, PieChart, Bell, ChevronRight,
  CircleCheck, Circle, Clock, Search, FileText, IndianRupee, Plus,
} from "lucide-react";
import {
  money, moneyShort, timeAgo, shortAgo, initials, avatarColor, dailySeries, dailyTotals,
} from "@/lib/format";
import { UNPAID, IN_PLAY } from "@/lib/rollup";
import { StatCard } from "@/components/ops/StatCard";
import { Donut } from "@/components/ops/Charts";
import type {
  Project, Payment, Proposal, OpsSignal, NowTask,
} from "@/types/ops";

// Shown in the greeting and the sidebar user block.
const OWNER_NAME = "Z";

const SEV_COLOR: Record<OpsSignal["severity"], string> = {
  critical: "#e5484d",
  high: "#f59e0b",
  warn: "#f59e0b",
  info: "#6b6b6b",
};

const DAY = 86_400_000;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function dueLabel(due: string | null): { text: string; tone: "overdue" | "soon" | "normal"; days: number | null } {
  if (!due) return { text: "No due date", tone: "normal", days: null };
  const d = new Date(due + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / DAY);
  if (diff < 0) return { text: `${Math.abs(diff)} days`, tone: "overdue", days: diff };
  if (diff === 0) return { text: "Due today", tone: "soon", days: 0 };
  return { text: `Due in ${diff}d`, tone: diff <= 3 ? "soon" : "normal", days: diff };
}

function countInWindow(timestamps: (string | null)[], fromDaysAgo: number, toDaysAgo: number) {
  const now = Date.now();
  return timestamps.filter((ts) => {
    if (!ts) return false;
    const t = new Date(ts).getTime();
    if (!Number.isFinite(t)) return false;
    const age = (now - t) / DAY;
    return age >= toDaysAgo && age < fromDaysAgo;
  }).length;
}

// ── Panel shell ──────────────────────────────────────────────

function Panel({
  n, nColor, title, sub, href, children, footer, className = "",
}: {
  n?: string; nColor?: string; title: string; sub?: string; href?: string;
  children: React.ReactNode; footer?: React.ReactNode; className?: string;
}) {
  return (
    <section className={`flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-surface ${className}`}>
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.09em] text-text">
            {n && <span className="tabular-nums" style={{ color: nColor }}>{n}</span>}
            {title}
          </h2>
          {sub && <p className="mt-0.5 text-[10.5px] text-text-muted">{sub}</p>}
        </div>
        {href && (
          <Link href={href} className="flex shrink-0 items-center gap-0.5 whitespace-nowrap text-[10.5px] text-text-muted transition-colors hover:text-text">
            View all <ChevronRight size={12} />
          </Link>
        )}
      </div>
      <div className="flex-1">{children}</div>
      {footer && <div className="border-t border-[var(--border)] px-4 py-2 text-center">{footer}</div>}
    </section>
  );
}

const TONE_CLS: Record<"overdue" | "soon" | "normal", string> = {
  overdue: "text-accent-red font-medium",
  soon: "text-accent-orange font-medium",
  normal: "text-text-muted",
};

const emptyCls = "px-4 py-8 text-center text-[12px] text-text-muted";
const rowCls = "flex items-center gap-2 border-t border-[var(--border)] px-4 py-2 text-[12.5px] transition-colors hover:bg-[var(--glow-white)]";

function Chip({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide"
      style={{ background: `${color}22`, color }}
    >
      {text}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [signals, setSignals] = useState<OpsSignal[]>([]);
  const [nowTasks, setNowTasks] = useState<NowTask[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const j = (url: string) => fetch(url).then((r) => r.json()).catch(() => []);
    const [pr, pay, prop, sig, now] = await Promise.all([
      j("/api/ops/projects"), j("/api/ops/payments"), j("/api/ops/proposals"),
      j("/api/ops/alerts"), j("/api/ops/now-tasks"),
    ]);
    setProjects(Array.isArray(pr) ? pr : []);
    setPayments(Array.isArray(pay) ? pay : []);
    setProposals(Array.isArray(prop) ? prop : []);
    setSignals(Array.isArray(sig) ? sig : []);
    setNowTasks(Array.isArray(now) ? now : []);
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

  const d = useMemo(() => {
    const open = signals.filter((s) => !s.seen);
    const critical = open.filter((s) => s.severity === "critical");
    const radar = open.filter((s) => s.severity !== "info").sort((a, b) => (a.ts < b.ts ? 1 : -1));

    const sevCounts = {
      critical: open.filter((s) => s.severity === "critical").length,
      high: open.filter((s) => s.severity === "high").length,
      warn: open.filter((s) => s.severity === "warn").length,
      info: signals.filter((s) => !s.seen && s.severity === "info").length,
    };

    const unpaid = payments.filter((p) => UNPAID.includes(p.status));
    const overdueRows = payments.filter((p) => p.status === "overdue");
    const paidRows = payments.filter((p) => p.status === "paid");
    const inPlay = proposals.filter((p) => IN_PLAY.includes(p.status));

    const receivable = unpaid.reduce((s, p) => s + (p.amount ?? 0), 0);
    // computed below from the exclusive buckets so the donut and the headline agree
    const pipelineTotal = inPlay.reduce((s, p) => s + (p.amount ?? 0), 0);

    // Receivables split by how far out they're due. Buckets are mutually
    // exclusive — an earlier version added overdue rows to BOTH the overdue
    // total and a due-date bucket, so the same money appeared twice in the
    // legend. Status wins: an invoice marked overdue is overdue whatever its
    // date says, and rows with no due date get their own bucket rather than
    // being silently lumped into "31 days+".
    const ageing = { overdue: 0, soon: 0, mid: 0, far: 0, undated: 0 };
    const overdueBuckets = { b1: 0, b2: 0, b3: 0, b4: 0 };
    // Invoices sitting in the total with no amount recorded — the headline
    // figure is an undercount whenever this is non-zero, so it must be shown.
    let unpricedCount = 0;

    for (const p of unpaid) {
      const amt = p.amount ?? 0;
      if (p.amount == null) unpricedCount += 1;
      const { days } = dueLabel(p.due);

      if (p.status === "overdue" || (days != null && days < 0)) {
        ageing.overdue += amt;
        if (days != null) {
          const od = Math.abs(days);
          if (od <= 15) overdueBuckets.b1 += amt;
          else if (od <= 30) overdueBuckets.b2 += amt;
          else if (od <= 60) overdueBuckets.b3 += amt;
          else overdueBuckets.b4 += amt;
        }
        continue;
      }
      if (days == null) { ageing.undated += amt; continue; }
      if (days <= 7) ageing.soon += amt;
      else if (days <= 30) ageing.mid += amt;
      else ageing.far += amt;
    }

    const openTasks = nowTasks.filter((t) => !t.done);
    const projectTasks = projects.flatMap((p) => (p.tasks ?? []).filter((t) => !t.done));
    const todayCount = openTasks.length + projectTasks.length;

    // Work actually in flight, soonest deadline first. Undated projects sort last
    // rather than jumping to the top on an empty string compare.
    const live = projects
      .filter((p) => p.status === "active" || p.status === "waiting")
      .map((p) => {
        const open = (p.tasks ?? []).filter((t) => !t.done).length;
        const { days } = dueLabel(p.end_date);
        return { ...p, openTasks: open, daysLeft: days };
      })
      .sort((a, b) => {
        if (a.daysLeft == null) return 1;
        if (b.daysLeft == null) return -1;
        return a.daysLeft - b.daysLeft;
      });

    // Proposal funnel — straight off the real status values.
    const funnel = [
      { label: "Leads", value: proposals.filter((p) => p.status === "draft").length, color: "#8b5cf6" },
      { label: "Proposals Sent", value: proposals.filter((p) => p.status === "sent").length, color: "#3b82f6" },
      { label: "In Negotiation", value: proposals.filter((p) => p.status === "discussing").length, color: "#00d4aa" },
      { label: "Won", value: proposals.filter((p) => p.status === "won").length, color: "#f59e0b" },
    ];
    const decided = proposals.filter((p) => p.status === "won" || p.status === "lost").length;
    const conversion = decided > 0
      ? (proposals.filter((p) => p.status === "won").length / decided) * 100
      : null;

    // Week-over-week, computed only where a real timestamp supports it.
    const critNow = countInWindow(critical.map((s) => s.ts), 1, 0);
    const critPrev = countInWindow(critical.map((s) => s.ts), 2, 1);
    const dueSoon = openTasks.filter((t) => dueLabel(t.due).tone !== "normal").length;

    // Activity answers "what happened", Radar answers "what's still wrong".
    // Anything currently ON the radar is excluded here by id — otherwise every
    // open alert renders twice, once in each panel.
    const onRadar = new Set(radar.map((s) => s.id));

    const activity = [
      // Only signals that are resolved/seen or purely informational.
      ...signals
        .filter((s) => !onRadar.has(s.id))
        .map((s) => ({
          key: `s-${s.id}`,
          color: s.seen ? "#6b6b6b" : SEV_COLOR[s.severity],
          text: s.seen ? `Resolved: ${s.title}` : s.title,
          ts: s.ts,
          kind: "signal" as const,
        })),
      ...paidRows.map((p) => ({
        key: `p-${p.id}`, color: "#00d4aa",
        text: `Payment received: ${money(p.amount)} from ${p.client ?? "client"}`,
        ts: p.created_at, kind: "money" as const,
      })),
      ...proposals.map((p) => ({
        key: `pr-${p.id}`, color: "#8b5cf6",
        text: `${p.name}: ${p.status}`,
        ts: p.sent ?? p.created_at, kind: "proposal" as const,
      })),
      // Completed focus tasks are genuine "this happened" events.
      ...nowTasks
        .filter((t) => t.done)
        .map((t) => ({
          key: `nt-${t.id}`, color: "#00d4aa",
          text: `Done: ${t.text}`, ts: t.created_at, kind: "task" as const,
        })),
      // Project movement, from the row's own updated_at.
      ...projects.map((p) => ({
        key: `pj-${p.id}`, color: "#3b82f6",
        text: `${p.name}: ${p.progress ?? 0}% · ${p.status}`,
        ts: p.updated_at, kind: "project" as const,
      })),
    ]
      .filter((a) => a.ts)
      .sort((a, b) => (a.ts < b.ts ? 1 : -1))
      .slice(0, 8);

    return {
      radar, critical, sevCounts, totalSignals: open.length,
      unpaid, overdueRows, inPlay, receivable, pipelineTotal,
      overdueTotal: ageing.overdue,
      ageing, overdueBuckets, unpricedCount, openTasks, todayCount, funnel, conversion,
      critNow, critPrev, dueSoon, activity, live,
      liveValue: live.reduce((s, p) => s + (p.budget ?? 0), 0),
      liveOpenTasks: live.reduce((s, p) => s + p.openTasks, 0),
      liveOverdue: live.filter((p) => p.daysLeft != null && p.daysLeft < 0).length,
      // Value per funnel stage, so the pipeline shows money not just counts.
      funnelValue: {
        draft: proposals.filter((p) => p.status === "draft").reduce((s, p) => s + (p.amount ?? 0), 0),
        sent: proposals.filter((p) => p.status === "sent").reduce((s, p) => s + (p.amount ?? 0), 0),
        discussing: proposals.filter((p) => p.status === "discussing").reduce((s, p) => s + (p.amount ?? 0), 0),
        won: proposals.filter((p) => p.status === "won").reduce((s, p) => s + (p.amount ?? 0), 0),
      },
      wonCount: proposals.filter((p) => p.status === "won").length,
      lostCount: proposals.filter((p) => p.status === "lost").length,
      avgDeal: (() => {
        const wonRows = proposals.filter((p) => p.status === "won" && p.amount != null);
        if (wonRows.length === 0) return null;
        return wonRows.reduce((s, p) => s + (p.amount ?? 0), 0) / wonRows.length;
      })(),
      topOverdue: overdueRows.slice().sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)).slice(0, 3),
      criticalSeries: dailySeries(open.map((s) => s.ts)),
      taskSeries: dailySeries(nowTasks.map((t) => t.created_at)),
      moneySeries: dailyTotals(unpaid.map((p) => ({ ts: p.created_at, amount: p.amount }))),
      pipelineSeries: dailyTotals(inPlay.map((p) => ({ ts: p.sent ?? p.created_at, amount: p.amount }))),
    };
  }, [projects, payments, proposals, signals, nowTasks]);


  const dateLine = loaded
    ? `Mission control · ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}`
    : "Loading your day…";

  return (
    // One viewport on desktop: the page itself never scrolls, each panel scrolls
    // internally. Below lg the grid unlocks and the page scrolls normally —
    // six panels stacked in 100vh on a phone would be unusable.
    <div className="flex flex-col gap-2.5 px-4 pb-24 pt-3 sm:px-5 lg:h-[100dvh] lg:overflow-hidden lg:pb-3 lg:pl-5 lg:pr-5">
      {/* ── Header ── */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[21px] font-bold leading-tight tracking-tight text-text sm:text-[24px]">
            {greeting()}, {OWNER_NAME}. <span className="inline-block">👋</span>
          </h1>
          <p className="text-[12px] text-text-muted">{dateLine}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label className="relative hidden items-center md:flex">
            <Search size={14} className="pointer-events-none absolute left-2.5 text-text-muted" />
            <input
              placeholder="Search anything…"
              className="w-48 rounded-lg border border-[var(--border)] bg-surface py-1.5 pl-8 pr-9 text-[12px] text-text placeholder:text-text-muted"
            />
            <kbd className="pointer-events-none absolute right-2 rounded border border-[var(--border-strong)] px-1 text-[9px] text-text-muted">⌘K</kbd>
          </label>
          {/* Theme toggle lives in the global TopBar; a second one here rendered
              two identical controls one row apart. */}
          <Link
            href="/dashboard/ops/alerts"
            className="relative rounded-lg border border-[var(--border-strong)] p-1.5 text-text-muted transition-colors hover:text-text"
            aria-label={`Alerts${d.radar.length ? `: ${d.radar.length} open` : ""}`}
          >
            <Bell size={15} />
            {d.radar.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-red px-1 text-[9px] font-bold text-white">
                {d.radar.length}
              </span>
            )}
          </Link>
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] py-1 pl-1 pr-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: avatarColor(OWNER_NAME) }}>
              {OWNER_NAME.slice(0, 1)}
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-[11.5px] font-medium text-text">{OWNER_NAME}</span>
              <span className="block text-[9.5px] text-text-muted">Administrator</span>
            </span>
          </div>
        </div>
      </header>

      {/* ── Stat cards ── */}
      <div className="grid shrink-0 grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          id="critical" icon={AlertTriangle} accent="red" label="Critical"
          value={String(d.critical.length)} sub="needs action now" series={d.criticalSeries}
          delta={d.critNow || d.critPrev ? { text: `${d.critNow} vs yesterday`, dir: d.critNow >= d.critPrev ? "up" : "down" } : null}
        />
        <StatCard
          id="today" icon={ListChecks} accent="amber" label="Today"
          value={String(d.todayCount)} sub="tasks & follow-ups" series={d.taskSeries}
          delta={d.dueSoon > 0 ? { text: `${d.dueSoon} due soon`, dir: "up" } : null}
        />
        <StatCard
          id="money" icon={Wallet} accent="green" label="Money waiting"
          value={moneyShort(d.receivable)} sub="receivables & overdue" series={d.moneySeries}
          delta={d.overdueTotal > 0 ? { text: `${moneyShort(d.overdueTotal)} overdue`, dir: "down" } : null}
        />
        <StatCard
          id="pipeline" icon={PieChart} accent="violet" label="Pipeline"
          value={moneyShort(d.pipelineTotal)} sub="proposals in play" series={d.pipelineSeries}
          delta={d.inPlay.length > 0 ? { text: `${d.inPlay.length} in play`, dir: "up" } : null}
        />
      </div>

      {/* ── Row A ── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 lg:grid-cols-12">
        <Panel
          n="01" nColor="#e5484d" title="ARC Radar" sub="What needs you right now"
          href="/dashboard/ops/alerts" className="lg:col-span-5"
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
          <div className="flex h-full min-h-0 gap-2">
            <div className="min-w-0 flex-1 overflow-y-auto">
              {d.radar.length === 0 ? (
                <p className={emptyCls}>{loaded ? "Radar is clear." : "Loading…"}</p>
              ) : (
                <ul>
                  {d.radar.map((s) => (
                    <li key={s.id} className={rowCls}>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: SEV_COLOR[s.severity] }} />
                      <span className="min-w-0 flex-1 truncate text-text">{s.title}</span>
                      {s.source && <Chip text={s.source} color={SEV_COLOR[s.severity]} />}
                      <span className="shrink-0 whitespace-nowrap text-[10.5px] text-text-muted">{timeAgo(s.ts)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>

        <Panel n="02" nColor="#f59e0b" title="Money" sub="Receivables & overdue" href="/dashboard/ops/money" className="lg:col-span-4">
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center gap-3 px-4 pb-2">
              <Donut
                size={78} thickness={9}
                center={moneyShort(d.receivable)} sub="open"
                segments={[
                  { label: "Overdue", value: d.ageing.overdue, color: "#e5484d" },
                  { label: "0–7 days", value: d.ageing.soon, color: "#00d4aa" },
                  { label: "8–30 days", value: d.ageing.mid, color: "#f59e0b" },
                  { label: "31+ days", value: d.ageing.far, color: "#3b82f6" },
                  { label: "No due date", value: d.ageing.undated, color: "#6b6b6b" },
                ]}
              />
              <ul className="min-w-0 flex-1 space-y-0.5">
                {[
                  { l: "Overdue", v: d.ageing.overdue, c: "#e5484d" },
                  { l: "Due 0–7d", v: d.ageing.soon, c: "#00d4aa" },
                  { l: "Due 8–30d", v: d.ageing.mid, c: "#f59e0b" },
                  { l: "Due 31d+", v: d.ageing.far, c: "#3b82f6" },
                  { l: "No due date", v: d.ageing.undated, c: "#6b6b6b" },
                ].filter((x) => x.v > 0).map((x) => (
                  <li key={x.l} className="flex items-center gap-1.5 text-[10px] text-text-muted">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: x.c }} />
                    <span className="flex-1 truncate">{x.l}</span>
                    <span className="tabular-nums text-text">{moneyShort(x.v)}</span>
                  </li>
                ))}
                {d.unpricedCount > 0 && (
                  <li className="flex items-center gap-1.5 pt-0.5 text-[10px] text-accent-orange">
                    <span className="flex-1 truncate">
                      + {d.unpricedCount} invoice{d.unpricedCount === 1 ? "" : "s"} with no amount
                    </span>
                  </li>
                )}
              </ul>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {d.unpaid.length === 0 ? (
                <p className={emptyCls}>{loaded ? "Nothing outstanding." : "Loading…"}</p>
              ) : (
                <ul>
                  {d.unpaid.map((p) => {
                    const { text, tone } = dueLabel(p.due);
                    return (
                      <li key={p.id} className={rowCls}>
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white" style={{ background: avatarColor(p.client) }}>
                          {initials(p.client)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium text-text">{p.client ?? "—"}</span>
                          <span className="block truncate text-[9.5px] text-text-muted">{p.item ?? "—"}</span>
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-[11.5px] tabular-nums text-text">{money(p.amount)}</span>
                        <span className={`shrink-0 whitespace-nowrap text-[10px] ${TONE_CLS[tone]}`}>{text}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </Panel>

        <Panel
          n="03" nColor="#00d4aa" title="Focus today"
          sub={`${d.openTasks.length} priority task${d.openTasks.length === 1 ? "" : "s"}`}
          href="/dashboard/ops/projects" className="lg:col-span-3"
        >
          <div className="h-full min-h-0 overflow-y-auto">
            {d.openTasks.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-4 py-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-[var(--border-strong)]">
                  <CircleCheck size={22} className="text-text-muted" />
                </span>
                <p className="mt-3 text-[13px] font-medium text-text">
                  {loaded ? "All clear for now" : "Loading…"}
                </p>
                <p className="mt-0.5 text-[11px] text-text-muted">You&apos;re up to date.</p>
                <Link
                  href="/dashboard/ops/projects"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-[11.5px] font-medium text-text transition-colors hover:bg-[var(--glow-white)]"
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
                      <button onClick={() => toggleTask(t)} className="shrink-0 text-text-muted transition-colors hover:text-accent-green" aria-label={`Mark "${t.text}" done`}>
                        {t.done ? <CircleCheck size={14} /> : <Circle size={14} />}
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
          </div>
        </Panel>
      </div>

      {/* ── Row B ── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 lg:grid-cols-12">
        <Panel
          n="04" nColor="#8b5cf6" title="Live work" sub="Active projects & timelines"
          href="/dashboard/ops/projects" className="lg:col-span-6"
          footer={
            <div className="grid grid-cols-4 gap-2 text-left">
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
          <div className="h-full min-h-0 overflow-y-auto">
            {d.live.length === 0 ? (
              <p className={emptyCls}>{loaded ? "Nothing in flight." : "Loading…"}</p>
            ) : (
              <ul>
                {d.live.map((p) => {
                  const late = p.daysLeft != null && p.daysLeft < 0;
                  const soon = p.daysLeft != null && p.daysLeft >= 0 && p.daysLeft <= 7;
                  return (
                    <li key={p.id} className="border-t border-[var(--border)] px-4 py-2 transition-colors hover:bg-[var(--glow-white)]">
                      <div className="flex items-center gap-2 text-[12.5px]">
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[8px] font-bold text-white"
                          style={{ background: avatarColor(p.client) }}
                        >
                          {initials(p.client)}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium text-text">{p.name}</span>
                        {p.status === "waiting" && <Chip text="waiting" color="#f59e0b" />}
                        <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-text-muted">
                          {moneyShort(p.budget)}
                        </span>
                        <span
                          className={`w-16 shrink-0 whitespace-nowrap text-right text-[10px] ${
                            late ? "font-medium text-accent-red" : soon ? "font-medium text-accent-orange" : "text-text-muted"
                          }`}
                        >
                          {p.daysLeft == null ? "no date" : late ? `${Math.abs(p.daysLeft)}d over` : `${p.daysLeft}d left`}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.max(0, Math.min(100, p.progress ?? 0))}%`,
                              background: late ? "#e5484d" : "#8b5cf6",
                            }}
                          />
                        </div>
                        <span className="shrink-0 text-[9.5px] tabular-nums text-text-muted">{p.progress ?? 0}%</span>
                        <span className="shrink-0 text-[9.5px] text-text-muted">{p.openTasks} open</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Panel>

        <Panel n="05" nColor="#3b82f6" title="Activity" sub="Latest across the system" href="/dashboard/ops/alerts" className="lg:col-span-4">
          <div className="h-full min-h-0 overflow-y-auto px-4 pb-3">
            {d.activity.length === 0 ? (
              <p className={emptyCls}>{loaded ? "Nothing has happened yet." : "Loading…"}</p>
            ) : (
              <ul>
                {d.activity.map((a, i) => (
                  <li key={a.key} className="relative flex gap-2.5 pb-2.5">
                    <span className="w-8 shrink-0 pt-0.5 text-right text-[9.5px] tabular-nums text-text-muted">
                      {shortAgo(a.ts)}
                    </span>
                    {/* Rail: dot per event, connector to the next one. */}
                    <span className="relative flex w-3 shrink-0 justify-center">
                      <span className="z-10 mt-1 h-1.5 w-1.5 rounded-full" style={{ background: a.color }} />
                      {i < d.activity.length - 1 && (
                        <span className="absolute top-2 h-full w-px bg-[var(--border)]" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 items-start gap-1.5">
                      <span className="mt-0.5 shrink-0">
                        {a.kind === "money" ? <IndianRupee size={11} color={a.color} />
                          : a.kind === "proposal" ? <FileText size={11} color={a.color} />
                          : a.kind === "task" ? <CircleCheck size={11} color={a.color} />
                          : a.kind === "project" ? <Clock size={11} color={a.color} />
                          : <AlertTriangle size={11} color={a.color} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-text">{a.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel n="06" nColor="#8b5cf6" title="Pipeline" sub="Proposal funnel" href="/dashboard/ops/proposals" className="lg:col-span-2">
          <div className="h-full min-h-0 overflow-y-auto px-3 pb-3">
            <ul className="space-y-1.5">
              {[
                { ...d.funnel[0], amount: d.funnelValue.draft },
                { ...d.funnel[1], amount: d.funnelValue.sent },
                { ...d.funnel[2], amount: d.funnelValue.discussing },
                { ...d.funnel[3], amount: d.funnelValue.won },
              ].map((s) => {
                const max = Math.max(...d.funnel.map((x) => x.value), 1);
                return (
                  <li key={s.label}>
                    <div className="flex items-center gap-1.5 text-[10.5px]">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
                      <span className="min-w-0 flex-1 truncate text-text-muted">{s.label}</span>
                      <span className="font-semibold tabular-nums text-text">{s.value}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                        <div className="h-full rounded-full" style={{ width: `${(s.value / max) * 100}%`, background: s.color }} />
                      </div>
                      <span className="shrink-0 text-[9px] tabular-nums text-text-muted">{moneyShort(s.amount)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 border-t border-[var(--border)] pt-2">
              <p className="text-[8.5px] uppercase tracking-wide text-text-muted">Value in play</p>
              <p className="text-[14px] font-bold tabular-nums text-text">{moneyShort(d.pipelineTotal)}</p>
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                <div>
                  <p className="text-[8.5px] uppercase tracking-wide text-text-muted">Win rate</p>
                  <p className="text-[12.5px] font-bold tabular-nums text-text">
                    {d.conversion == null ? "—" : `${d.conversion.toFixed(0)}%`}
                  </p>
                  {d.lostCount === 0 && d.wonCount > 0 && (
                    <p className="text-[8px] text-text-muted">no losses logged</p>
                  )}
                </div>
                <div>
                  <p className="text-[8.5px] uppercase tracking-wide text-text-muted">Avg deal</p>
                  <p className="text-[12.5px] font-bold tabular-nums text-text">{moneyShort(d.avgDeal)}</p>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
