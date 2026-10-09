"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { StatusPill } from "@/components/ui/StatusPill";
import { MiniMarkdown } from "@/components/team/MiniMarkdown";

/**
 * Team: the people who work inside ARC with their own login (sales first).
 * Add someone and set their password, switch them off, give them tasks, hand
 * them leads, and write the playbook they learn from and the Ask assistant
 * answers from. They sign in at /login with their login name and see /team.
 */
type Member = {
  id: string; name: string; username: string; active: boolean; last_login_at: string | null; created_at: string;
  leads: number; leads_open: number; tasks_open: number; updates_7d: number; calls_7d: number;
};
type Task = { id: string; member_id: string; title: string; details: string | null; due_on: string | null; status: string };

const input = "h-9 rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-text outline-none placeholder:text-text-muted focus:border-[var(--brand-line)]";
const btn = "flex h-9 items-center gap-1.5 rounded-soft border border-[var(--border)] px-3 text-[12.5px] text-text hover:bg-[var(--surface-hover)] disabled:opacity-50";
const primary = "flex h-9 items-center gap-1.5 rounded-soft bg-[var(--brand)] px-3.5 text-[12.5px] font-semibold text-[var(--brand-ink)] hover:opacity-90 disabled:opacity-50";

async function call(path: string, method: string, body?: unknown) {
  const r = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "That didn't work. Try again.");
  return j;
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-panel border border-[var(--border)] bg-surface">
      <div className="px-4 pb-2 pt-3.5">
        <h2 className="text-[14px] font-semibold tracking-tight text-text">{title}</h2>
        {sub && <p className="mt-0.5 text-[11.5px] text-text-muted">{sub}</p>}
      </div>
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}

function AddMember({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ name: "", username: "", password: "" });
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await call("/api/team/members", "POST", f); setF({ name: "", username: "", password: "" }); onDone(); }
    catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input required className={input} placeholder="Name" value={f.name} aria-label="Name"
        onChange={(e) => setF({ ...f, name: e.target.value, username: f.username || "" })} />
      <input required className={input} placeholder="Login name (e.g. rahul)" value={f.username} aria-label="Login name"
        onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, "") })} />
      <input required type="password" autoComplete="new-password" className={input} placeholder="Password (8+ characters)" value={f.password} aria-label="Password"
        onChange={(e) => setF({ ...f, password: e.target.value })} />
      <button disabled={busy} className={primary}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add person</button>
      {err && <p className="w-full text-[12px] text-accent-red">{err}</p>}
    </form>
  );
}

function MemberCard({ m, onChanged }: { m: Member; onChanged: () => void }) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [t, setT] = useState({ title: "", details: "", due_on: "" });
  const [pw, setPw] = useState("");
  const [give, setGive] = useState({ count: 10, from: "inbound" });
  const [busy, setBusy] = useState(""), [note, setNote] = useState(""), [err, setErr] = useState("");
  const loadTasks = useCallback(async () => {
    const r = await fetch(`/api/team/tasks?member=${m.id}`, { cache: "no-store" });
    if (r.ok) setTasks((await r.json()).tasks);
  }, [m.id]);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  async function run(key: string, fn: () => Promise<string | void>) {
    setBusy(key); setErr(""); setNote("");
    try { const n = await fn(); if (n) setNote(n); } catch (x) { setErr((x as Error).message); }
    setBusy("");
  }

  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-[15px] font-semibold text-text">
            {m.name} <StatusPill status={m.active ? "active" : "switched off"} tone={m.active ? "good" : "neutral"} />
          </p>
          <p className="text-[11.5px] text-text-muted">
            Logs in as <span className="text-text">{m.username}</span> · last login {m.last_login_at ? timeAgo(m.last_login_at) : "never"}
          </p>
        </div>
        <button className={btn} disabled={!!busy}
          onClick={() => run("active", async () => { await call(`/api/team/members/${m.id}`, "PATCH", { active: !m.active }); onChanged(); })}>
          {m.active ? "Switch off" : "Switch back on"}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Leads", `${m.leads_open} open`, `${m.leads} in all`], ["Tasks open", m.tasks_open, ""], ["Updates, 7 days", m.updates_7d, ""], ["Calls logged, 7 days", m.calls_7d, ""]].map(([l, v, h]) => (
          <div key={String(l)} className="rounded-lg bg-[var(--surface-hover)] px-3 py-2">
            <p className="text-[10.5px] uppercase tracking-wide text-text-muted">{l}</p>
            <p className="text-[16px] font-semibold tabular-nums text-text">{v}</p>
            {h && <p className="text-[10.5px] text-text-muted">{h}</p>}
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">Tasks</p>
          <ul className="mb-2 flex flex-col gap-1">
            {(tasks || []).map((x) => (
              <li key={x.id} className="flex items-start gap-2 text-[12.5px]">
                <StatusPill status={x.status} tone={x.status === "done" ? "good" : x.status === "doing" ? "info" : "neutral"} />
                <span className={`min-w-0 flex-1 ${x.status === "done" ? "text-text-muted line-through" : "text-text"}`}>
                  {x.title}{x.due_on ? <span className="text-text-muted"> · due {x.due_on}</span> : null}
                </span>
                <button aria-label="Remove task" className="text-text-muted hover:text-accent-red"
                  onClick={() => run("del", async () => { await call(`/api/team/tasks/${x.id}`, "DELETE"); loadTasks(); onChanged(); })}>
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
            {tasks && !tasks.length && <li className="text-[12px] text-text-muted">No tasks yet.</li>}
          </ul>
          <form className="flex flex-col gap-2" onSubmit={(e) => {
            e.preventDefault();
            run("task", async () => {
              await call("/api/team/tasks", "POST", { member_id: m.id, ...t });
              setT({ title: "", details: "", due_on: "" }); loadTasks(); onChanged();
            });
          }}>
            <input required className={input} placeholder="New task, e.g. Call every inbound lead from this week" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} aria-label="Task" />
            <div className="flex gap-2">
              <input className={input + " flex-1"} placeholder="Details (optional)" value={t.details} onChange={(e) => setT({ ...t, details: e.target.value })} aria-label="Task details" />
              <input type="date" className={input} value={t.due_on} onChange={(e) => setT({ ...t, due_on: e.target.value })} aria-label="Due date" />
              <button disabled={!!busy} className={primary}>Add</button>
            </div>
          </form>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">Hand out leads</p>
            <div className="flex flex-wrap items-center gap-2">
              <input type="number" min={1} max={200} className={input + " w-20"} value={give.count} aria-label="How many leads"
                onChange={(e) => setGive({ ...give, count: Number(e.target.value) })} />
              <select className={input} value={give.from} aria-label="Which leads" onChange={(e) => setGive({ ...give, from: e.target.value })}>
                <option value="inbound">unassigned inbound (newest first)</option>
                <option value="outbound">unassigned outbound with a phone (oldest first)</option>
              </select>
              <button className={btn} disabled={!!busy}
                onClick={() => run("give", async () => {
                  const j = await call("/api/team/assign", "POST", { member_id: m.id, ...give });
                  onChanged();
                  return j.assigned ? `${j.assigned} lead${j.assigned === 1 ? "" : "s"} given to ${m.name}.` : "No unassigned leads of that kind left.";
                })}>
                Give
              </button>
            </div>
            <p className="mt-1 text-[11px] text-text-muted">Or assign one lead at a time from its panel (Outreach or the sales view).</p>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">New password</p>
            <div className="flex gap-2">
              <input type="password" autoComplete="new-password" className={input + " flex-1"} placeholder="8+ characters" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="New password" />
              <button className={btn} disabled={!!busy || pw.length < 8}
                onClick={() => run("pw", async () => { await call(`/api/team/members/${m.id}`, "PATCH", { password: pw }); setPw(""); return "Password changed. Tell them the new one in person."; })}>
                Set
              </button>
            </div>
          </div>
        </div>
      </div>
      {(note || err) && <p className={`mt-3 text-[12px] ${err ? "text-accent-red" : "text-accent-green"}`}>{err || note}</p>}
    </div>
  );
}

function Playbook() {
  const [text, setText] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  useEffect(() => { fetch("/api/team/playbook").then((r) => r.json()).then((j) => { setText(j.text || ""); setSaved(j.text || ""); }); }, []);
  async function save() {
    setBusy(true); setMsg("");
    try { await call("/api/team/playbook", "PUT", { text }); setSaved(text); setMsg("Saved. The team sees it now, and Ask answers from it."); }
    catch (x) { setMsg((x as Error).message); }
    setBusy(false);
  }
  if (text === null) return <div className="flex h-24 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={16} /></div>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} onClick={() => setPreview(!preview)}>{preview ? "Edit" : "Preview"}</button>
        <button className={primary} disabled={busy || text === saved} onClick={save}>{busy ? "Saving…" : text === saved ? "Saved" : "Save playbook"}</button>
        {msg && <span className="text-[12px] text-text-muted">{msg}</span>}
      </div>
      {preview ? (
        <div className="max-h-[560px] overflow-auto rounded-lg border border-[var(--border)] p-4"><MiniMarkdown text={text} /></div>
      ) : (
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={22} aria-label="Playbook"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[12.5px] leading-relaxed text-text outline-none focus:border-[var(--brand-line)]" />
      )}
      <p className="text-[11px] text-text-muted">Markdown: # headings, - lists, **bold**. Put prices, offers and rules here; the assistant won&apos;t answer what isn&apos;t written.</p>
    </div>
  );
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    const r = await fetch("/api/team/members", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || "Team could not load.");
    setMembers(j.members); setErr("");
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text">Team</h1>
          <p className="max-w-[70ch] text-[12.5px] text-text-muted">
            People with their own ARC login. They sign in at arc.bconclub.com/login with their login name and password, and land in the sales view: Today, Leads, AI calls, Ask and Getting started. They can&apos;t open the rest of ARC, delete leads or see call costs.
          </p>
        </div>
        <Link href="/team" className={btn}><ExternalLink size={14} /> Open the sales view</Link>
      </header>

      <Panel title="People" sub="Add someone, then tell them their login name and password in person.">
        <div className="flex flex-col gap-3">
          <AddMember onDone={load} />
          {err && <p className="text-[12px] text-accent-red">{err}</p>}
          {!members ? (
            <div className="flex h-24 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={16} /></div>
          ) : (
            members.map((m) => <MemberCard key={m.id} m={m} onChanged={load} />)
          )}
          {members && !members.length && <p className="text-[12.5px] text-text-muted">Nobody yet. Add your first person above.</p>}
        </div>
      </Panel>

      <Panel title="Playbook" sub="Their onboarding reading (Getting started) and the only source the Ask assistant answers from.">
        <Playbook />
      </Panel>
    </div>
  );
}
