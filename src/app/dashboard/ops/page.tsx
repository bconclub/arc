"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sun, Plus, X } from "lucide-react";
import { money, dueClass } from "@/lib/format";
import { btnPrimaryCls, inputCls } from "@/components/ops/Modal";
import type { Project, Payment, Proposal, OpsSignal, NowTask } from "@/types/ops";

const SEV_DOT: Record<string, string> = {
  critical: "bg-accent-red",
  high: "bg-accent-orange",
  warn: "bg-accent-orange",
  info: "bg-text-muted",
};

function DueBadge({ due }: { due: string | null }) {
  if (!due) return null;
  const cls = dueClass(due);
  return (
    <span
      className={`ml-auto whitespace-nowrap text-[11px] tabular-nums ${
        cls === "overdue" ? "font-semibold text-accent-red" : cls === "soon" ? "font-semibold text-accent-orange" : "text-text-muted"
      }`}
    >
      {due}
      {cls === "overdue" ? " · overdue" : ""}
    </span>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{title}</h3>
      {children}
    </section>
  );
}

const rowCls = "flex items-baseline gap-2.5 border-t border-[var(--border)] px-4 py-2.5 text-[13px] first:border-t-0";
const listCls = "rounded-card border border-[var(--border)] bg-surface overflow-hidden";
const emptyCls = "rounded-card border border-dashed border-[var(--border)] px-6 py-8 text-center text-[13px] text-text-muted";

export default function OpsTodayPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [signals, setSignals] = useState<OpsSignal[]>([]);
  const [nowTasks, setNowTasks] = useState<NowTask[]>([]);
  const [newTask, setNewTask] = useState("");
  const [newDue, setNewDue] = useState("");

  const load = useCallback(async () => {
    const [pr, pay, prop, sig, now] = await Promise.all([
      fetch("/api/ops/projects").then((r) => r.json()),
      fetch("/api/ops/payments").then((r) => r.json()),
      fetch("/api/ops/proposals").then((r) => r.json()),
      fetch("/api/ops/alerts").then((r) => r.json()),
      fetch("/api/ops/now-tasks").then((r) => r.json()),
    ]);
    setProjects(Array.isArray(pr) ? pr : []);
    setPayments(Array.isArray(pay) ? pay : []);
    setProposals(Array.isArray(prop) ? prop : []);
    setSignals(Array.isArray(sig) ? sig : []);
    setNowTasks(Array.isArray(now) ? now : []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const attention: { due: string; text: string; proj: string }[] = [];
  for (const p of projects) {
    for (const t of p.tasks ?? []) {
      if (!t.done && t.due && dueClass(t.due)) attention.push({ due: t.due, text: t.text, proj: p.name });
    }
  }
  for (const t of nowTasks) {
    if (!t.done && t.due && dueClass(t.due)) attention.push({ due: t.due, text: t.text, proj: "Now" });
  }
  attention.sort((a, b) => (a.due < b.due ? -1 : 1));

  const importantSignals = signals.filter((s) => ["high", "critical"].includes(s.severity) && !s.seen);
  const waiting = projects.filter((p) => p.status === "waiting");
  const unpaid = payments.filter((r) => ["pending", "invoiced", "overdue"].includes(r.status));
  const inPlay = proposals.filter((p) => ["sent", "discussing"].includes(p.status));

  async function addNowTask() {
    if (!newTask.trim()) return;
    await fetch("/api/ops/now-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newTask, due: newDue || null }),
    });
    setNewTask("");
    setNewDue("");
    load();
  }

  async function toggleNowTask(t: NowTask) {
    await fetch(`/api/ops/now-tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !t.done }),
    });
    load();
  }

  async function removeNowTask(t: NowTask) {
    await fetch(`/api/ops/now-tasks/${t.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-8 px-1 pb-24">
      <div className="flex items-center gap-2.5">
        <Sun size={18} className="text-text-muted" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">Today</h1>
          <p className="mt-0.5 text-[13px] text-text-muted">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
      </div>

      {importantSignals.length > 0 && (
        <Card title="Signals needing attention">
          <ul className={listCls}>
            {importantSignals.map((s) => (
              <li key={s.id} className={rowCls}>
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${SEV_DOT[s.severity]}`} />
                <span className="font-medium text-text">{s.title}</span>
                <span className="ml-auto text-[11px] text-text-muted">{s.source || "manual"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Needs attention — overdue & next 3 days">
        {attention.length === 0 ? (
          <div className={emptyCls}>Nothing here.</div>
        ) : (
          <ul className={listCls}>
            {attention.map((a, i) => (
              <li key={i} className={rowCls}>
                <span className="text-text-muted">○</span>
                <span className="text-text">{a.text}</span>
                <span className="whitespace-nowrap rounded-full border border-[var(--border)] px-2 text-[10px] text-text-muted">
                  {a.proj}
                </span>
                <DueBadge due={a.due} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Focus list">
        {nowTasks.length === 0 ? (
          <div className={emptyCls}>Nothing here.</div>
        ) : (
          <ul className={listCls}>
            {nowTasks.map((t) => (
              <li key={t.id} className={`${rowCls} ${t.done ? "text-text-muted line-through" : ""}`}>
                <button onClick={() => toggleNowTask(t)} className={t.done ? "text-accent-green" : "text-text-muted"}>
                  {t.done ? "✓" : "○"}
                </button>
                <span className={t.done ? "" : "text-text"}>{t.text}</span>
                {!t.done && <DueBadge due={t.due} />}
                <button onClick={() => removeNowTask(t)} className="text-text-muted hover:text-accent-red">
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2.5 flex gap-2">
          <input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNowTask()}
            placeholder="Add to the focus list…"
            className={inputCls}
          />
          <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} className={`${inputCls} w-40`} />
          <button onClick={addNowTask} className={`${btnPrimaryCls} flex items-center gap-1`}>
            <Plus size={13} /> Add
          </button>
        </div>
      </Card>

      {waiting.length > 0 && (
        <Card title="Waiting on others">
          <ul className={listCls}>
            {waiting.map((p) => (
              <li key={p.id} className={rowCls}>
                <Link href="/dashboard/ops/projects" className="font-medium text-text hover:underline">
                  {p.name}
                </Link>
                <span className="text-text-muted">{p.client}</span>
                <span className="ml-auto text-[12px] text-text-muted">{p.next || "—"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {unpaid.length > 0 && (
        <Card title="Money out there">
          <ul className={listCls}>
            {unpaid.map((r) => (
              <li key={r.id} className={rowCls}>
                <span className="font-medium text-text">{r.client}</span>
                <span className="text-text-muted">{r.item}</span>
                <span className="tabular-nums text-text">{money(r.amount)}</span>
                <span
                  className={`ml-auto text-[11px] ${r.status === "overdue" ? "font-semibold text-accent-red" : "text-text-muted"}`}
                >
                  {r.due || "—"} · {r.status}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {inPlay.length > 0 && (
        <Card title="Proposals in play">
          <ul className={listCls}>
            {inPlay.map((p) => (
              <li key={p.id} className={rowCls}>
                <span className="font-medium text-text">{p.name}</span>
                <span className="tabular-nums text-text-muted">{money(p.amount)}</span>
                <span className="ml-auto text-[11px] text-text-muted">{p.status}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
