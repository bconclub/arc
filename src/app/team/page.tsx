"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Circle, CircleDot, Loader2 } from "lucide-react";
import { timeAgo } from "@/lib/format";
import type { OutreachTarget } from "@/types/ops";
import { LeadRow } from "@/components/team/LeadRow";
import { LeadModals, dueBy, isInbound, isOpen, todayIso, useTeamData } from "@/components/team/useTeamData";

/**
 * Today: what to do right now. Tasks the owner gave, follow-ups due, and new
 * inbound leads nobody has picked up yet. Everything opens the same lead panel.
 */
type Task = { id: string; title: string; details: string | null; due_on: string | null; status: "todo" | "doing" | "done"; target_id: string | null; done_at: string | null };

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-panel border border-[var(--border)] bg-surface px-4 py-3">
      <p className="text-[10.5px] uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-0.5 text-[22px] font-semibold tabular-nums text-text">{value}</p>
      {hint && <p className="text-[11px] text-text-muted">{hint}</p>}
    </div>
  );
}

function Panel({ title, sub, action, children }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-panel border border-[var(--border)] bg-surface">
      <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-3.5">
        <div>
          <h2 className="text-[14px] font-semibold tracking-tight text-text">{title}</h2>
          {sub && <p className="mt-0.5 text-[11.5px] text-text-muted">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function TeamToday() {
  const { me, leads, calls, error, byTarget, reload } = useTeamData();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [call, setCall] = useState<string | null>(null);
  const today = todayIso();
  const myId = me?.me?.id ?? null;

  const loadTasks = useCallback(async () => {
    const r = await fetch("/api/team/tasks", { cache: "no-store" });
    if (r.ok) setTasks((await r.json()).tasks);
  }, []);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  async function move(t: Task) {
    const status = t.status === "todo" ? "doing" : t.status === "doing" ? "done" : "todo";
    setTasks((x) => x?.map((y) => (y.id === t.id ? { ...y, status } : y)) ?? null);
    await fetch(`/api/team/tasks/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    loadTasks();
  }

  const all = useMemo(() => leads?.targets || [], [leads]);
  const mine = useMemo(() => all.filter((t) => (myId ? t.owner_id === myId : true)), [all, myId]);
  const due = useMemo(() => mine.filter((t) => dueBy(t, today)).sort((a, b) => (a.next_at || "").localeCompare(b.next_at || "")), [mine, today]);
  const since = useMemo(() => new Date(Date.now() - 3 * 864e5).toISOString(), []);
  const fresh = useMemo(
    () => all.filter((t) => isInbound(t) && isOpen(t) && (!t.owner_id || t.owner_id === myId) && (t.inbound?.came_in_at || t.created_at) >= since)
      .sort((a, b) => (b.inbound?.came_in_at || b.created_at).localeCompare(a.inbound?.came_in_at || a.created_at)),
    [all, myId, since],
  );
  const loggedToday = useMemo(
    () => (leads?.activity || []).filter((a) => a.occurred_at.slice(0, 10) === today && (me?.me ? a.worker === me.me.name : a.worker === "manual")),
    [leads, today, me],
  );
  const openTasks = (tasks || []).filter((t) => t.status !== "done");
  const doneTasks = (tasks || []).filter((t) => t.status === "done").slice(0, 5);
  const names = new Map((me?.members || []).map((m) => [m.id, m.name]));
  const open: Partial<OutreachTarget> | null = all.find((t) => t.id === openId) ?? null;
  const hour = new Date().getHours();

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-text">
          {hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}{me?.me ? `, ${me.me.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-[12.5px] text-text-muted">Your tasks, the follow-ups due, and new inbound leads. Start at the top.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Tasks open" value={tasks ? openTasks.length : "-"} hint={openTasks.filter((t) => t.due_on && t.due_on <= today).length ? `${openTasks.filter((t) => t.due_on && t.due_on <= today).length} due today` : undefined} />
        <Stat label="Follow-ups due" value={leads ? due.length : "-"} hint="today or overdue" />
        <Stat label="New inbound" value={leads ? fresh.length : "-"} hint="last 3 days, yours or untaken" />
        <Stat label="Logged today" value={leads ? loggedToday.length : "-"} hint={(() => { const n = loggedToday.filter((a) => a.channel === "call").length; return `${n} call${n === 1 ? "" : "s"}`; })()} />
      </div>

      {error && <p className="text-[13px] text-accent-red">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="My tasks" sub="From Z. Tap the circle to move a task: to do, doing, done.">
          {!tasks ? (
            <div className="flex h-24 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={16} /></div>
          ) : (
            <ul className="px-2 pb-2">
              {[...openTasks, ...doneTasks].map((t) => (
                <li key={t.id} className="flex items-start gap-2 rounded-lg px-2 py-2 hover:bg-[var(--surface-hover)]">
                  <button onClick={() => move(t)} aria-label={`Task ${t.status}, move on`} className="mt-0.5 shrink-0 text-text-muted hover:text-text">
                    {t.status === "done" ? <Check size={17} className="text-accent-green" /> : t.status === "doing" ? <CircleDot size={17} className="text-accent-blue" /> : <Circle size={17} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] ${t.status === "done" ? "text-text-muted line-through" : "font-medium text-text"}`}>{t.title}</p>
                    {t.details && t.status !== "done" && <p className="mt-0.5 whitespace-pre-wrap text-[12px] text-text-muted">{t.details}</p>}
                    <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-text-muted">
                      {t.status === "doing" && <span className="text-accent-blue">Doing</span>}
                      {t.due_on && <span className={t.status !== "done" && t.due_on <= today ? "font-semibold text-accent-red" : ""}>Due {t.due_on}</span>}
                      {t.target_id && <button onClick={() => setOpenId(t.target_id)} className="underline">Open the lead</button>}
                    </p>
                  </div>
                </li>
              ))}
              {!tasks.length && <li className="px-2 py-6 text-center text-[12.5px] text-text-muted">No tasks yet. Z will add them here.</li>}
            </ul>
          )}
        </Panel>

        <Panel title="Follow-ups due" sub="Your leads with a follow-up date today or earlier." action={<Link href="/team/leads" className="text-[12px] text-text-muted hover:text-text">All leads</Link>}>
          {!leads ? (
            <div className="flex h-24 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={16} /></div>
          ) : (
            <ul>
              {due.slice(0, 15).map((t) => <LeadRow key={t.id} t={t} owner={names.get(t.owner_id || "") || null} onOpen={() => setOpenId(t.id)} />)}
              {!due.length && <li className="px-4 py-6 text-center text-[12.5px] text-text-muted">Nothing due. Set a follow-up date whenever you log a call.</li>}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="New inbound leads" sub={`People who came to PROXe in the last 3 days: yours, and the ones nobody has taken yet.${leads?.inbound_synced_at ? ` PROXe checked ${timeAgo(leads.inbound_synced_at)}.` : ""}`}>
        {!leads ? (
          <div className="flex h-24 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={16} /></div>
        ) : (
          <ul>
            {fresh.slice(0, 20).map((t) => <LeadRow key={t.id} t={t} owner={names.get(t.owner_id || "") || null} onOpen={() => setOpenId(t.id)} />)}
            {!fresh.length && <li className="px-4 py-6 text-center text-[12.5px] text-text-muted">{leads.sync_error || "No new inbound leads waiting."}</li>}
          </ul>
        )}
      </Panel>

      <LeadModals target={open} activity={openId ? byTarget.get(openId) || [] : []} calls={calls} ready={leads?.reportingReady ?? false}
        onClose={() => setOpenId(null)} onSaved={reload} call={call} setCall={setCall} />
    </div>
  );
}
