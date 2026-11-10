"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Loader2, Plus, RefreshCw, Trash2, Undo2 } from "lucide-react";

/**
 * The one place for the AI callers. Four lists, newest first: what Z said about
 * the calls, what the calls themselves teach, what is still broken, and every
 * change made to a caller. Agents post here through /api/agent/outreach/notes and
 * read it before they touch a caller; Z adds and closes notes on this page.
 */
type Kind = "feedback" | "learning" | "issue" | "change";
type Note = {
  id: string; kind: Kind; caller: string | null; body: string; action: string | null; author: string
  call_id: string | null; noted_on: string; resolved_at: string | null; source: string
};

const KINDS: { key: Kind; label: string; blurb: string; add: string; actionLabel: string }[] = [
  { key: "feedback", label: "Z's feedback", blurb: "What Z said about the calls, in his words.", add: "What did you notice on the call?", actionLabel: "What it should become (optional)" },
  { key: "learning", label: "What the calls teach", blurb: "Patterns from real calls: what gets through and where people drop.", add: "What did the calls show?", actionLabel: "What to do about it (optional)" },
  { key: "issue", label: "Open problems", blurb: "What is still broken, until it is marked fixed.", add: "What is broken?", actionLabel: "The fix (optional)" },
  { key: "change", label: "Changes made", blurb: "Every edit to a caller or the dial flow: what, why, and where the old version is.", add: "What was changed?", actionLabel: "Why, and where the old version is backed up" },
];
const CALLERS = ["Intro Cold", "Intro DM", "Follow-up"];
const day = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const field = "w-full rounded-soft border border-[var(--border)] bg-transparent px-3 py-2 text-[13px] text-text placeholder:text-text-muted focus:border-[var(--brand-line)] focus:outline-none";

export default function CallerLog() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [tab, setTab] = useState<Kind>("feedback");
  const [caller, setCaller] = useState("");
  const [showFixed, setShowFixed] = useState(false);
  const [draft, setDraft] = useState({ body: "", action: "", caller: "Intro Cold", call_id: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const r = await fetch("/api/outreach/notes", { cache: "no-store" });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setNotes(d.notes || []);
      setCanEdit(!!d.canEdit);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<Kind, number> = { feedback: 0, learning: 0, issue: 0, change: 0 };
    for (const n of notes) if (!(n.kind === "issue" && n.resolved_at)) c[n.kind]++;
    return c;
  }, [notes]);
  const kind = KINDS.find((k) => k.key === tab)!;
  const list = notes
    .filter((n) => n.kind === tab)
    .filter((n) => !caller || n.caller === caller || !n.caller)
    .filter((n) => tab !== "issue" || showFixed || !n.resolved_at);
  const fixedCount = notes.filter((n) => n.kind === "issue" && n.resolved_at).length;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.body.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/outreach/notes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: tab, body: draft.body, action: draft.action, caller: draft.caller, call_id: draft.call_id }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not save the note.");
      setNotes((prev) => [d.note, ...prev]);
      setDraft((prev) => ({ ...prev, body: "", action: "", call_id: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the note.");
    } finally {
      setSaving(false);
    }
  }

  async function setFixed(n: Note, resolved: boolean) {
    setError("");
    const r = await fetch("/api/outreach/notes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id, resolved }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setError(d.error || "Could not update the note.");
    setNotes((prev) => prev.map((x) => (x.id === n.id ? d.note : x)));
  }

  async function remove(n: Note) {
    if (!window.confirm("Remove this note for everyone?")) return;
    setError("");
    const r = await fetch(`/api/outreach/notes?id=${encodeURIComponent(n.id)}`, { method: "DELETE" });
    if (!r.ok) return setError("Could not remove the note.");
    setNotes((prev) => prev.filter((x) => x.id !== n.id));
  }

  return (
    <div className="page flex min-w-0 max-w-full flex-col gap-4 text-text">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/dashboard/outreach" className="mb-1 flex w-fit items-center gap-1 text-[12px] text-text-muted hover:text-text">
            <ArrowLeft size={13} /> Outreach
          </Link>
          <h1 className="text-[22px] font-bold tracking-tight text-text">Caller log</h1>
          <p className="max-w-[72ch] text-[12.5px] text-text-muted">
            One place for the AI callers: your feedback, what the calls teach, what is still broken, and every change made. Every agent reads this before it touches a caller and writes here after.
          </p>
        </div>
        <button onClick={load} disabled={state === "loading"}
          className="flex h-10 items-center gap-2 rounded-soft border border-[var(--border)] px-3 text-[13px] text-text hover:bg-[var(--surface-hover)] disabled:opacity-50">
          {state === "loading" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {KINDS.map((k) => (
          <button key={k.key} onClick={() => setTab(k.key)} aria-pressed={tab === k.key}
            className={`h-8 rounded-pill border px-3 text-[12px] ${tab === k.key ? "border-[var(--brand-line)] bg-[var(--brand)] text-[var(--brand-ink)]" : "border-[var(--border)] text-text-muted hover:text-text"}`}>
            {k.label} <span className="ml-1 tabular-nums">{state === "ready" ? counts[k.key] : "…"}</span>
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-[12px] text-text-muted">
          Caller
          <select value={caller} onChange={(e) => setCaller(e.target.value)} className="h-8 rounded-soft border border-[var(--border)] bg-transparent px-2 text-[12px] text-text">
            <option value="">All</option>
            {CALLERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <p className="text-[12.5px] text-text-muted">{kind.blurb}</p>

      {canEdit && (
        <form onSubmit={add} className="flex flex-col gap-2 rounded-panel border border-[var(--border)] bg-surface p-3">
          <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={2} placeholder={kind.add} aria-label={kind.add} className={field} />
          <div className="flex flex-wrap items-center gap-2">
            <input value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} placeholder={kind.actionLabel} aria-label={kind.actionLabel} className={`${field} min-w-0 flex-1 basis-64`} />
            <select value={draft.caller} onChange={(e) => setDraft({ ...draft, caller: e.target.value })} aria-label="Caller" className={`${field} w-auto`}>
              {CALLERS.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="">All callers</option>
            </select>
            <input value={draft.call_id} onChange={(e) => setDraft({ ...draft, call_id: e.target.value })} placeholder="Call id (optional)" aria-label="Call id" className={`${field} w-44`} />
            <button type="submit" disabled={saving || !draft.body.trim()}
              className="flex h-9 items-center gap-1.5 rounded-soft border border-[var(--brand-line)] bg-[var(--brand)] px-3 text-[13px] text-[var(--brand-ink)] disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
            </button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-[13px] text-accent-red">{error}</p>}

      {state === "loading" && !notes.length ? (
        <div className="flex h-40 items-center justify-center gap-2 text-[12.5px] text-text-muted"><Loader2 className="animate-spin" size={18} /> Loading the caller log.</div>
      ) : state === "error" ? (
        <p className="text-[13px] text-accent-red">The caller log is unavailable right now. Try Refresh in a minute.</p>
      ) : (
        <section className="overflow-hidden rounded-panel border border-[var(--border)] bg-surface">
          <ul>
            {list.map((n) => (
              <li key={n.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 border-t border-[var(--border)] px-3 py-2.5 first:border-t-0">
                <div className="min-w-0 flex-1">
                  <p className={`whitespace-pre-wrap text-[13px] ${n.resolved_at ? "text-text-muted line-through" : "text-text"}`}>{n.body}</p>
                  {n.action && <p className="mt-0.5 whitespace-pre-wrap text-[12px] text-text-muted">→ {n.action}</p>}
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] text-text-muted">
                    <span>{day(n.noted_on)}</span>
                    <span>{n.author}</span>
                    {n.caller && <span className="rounded-pill bg-[var(--surface-hover)] px-2 py-0.5 text-[10.5px] text-text">{n.caller}</span>}
                    {n.call_id && <span className="font-mono text-[10.5px]">{n.call_id}</span>}
                    {n.resolved_at && <span className="text-accent-green">Fixed {new Date(n.resolved_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })}</span>}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    {n.kind === "issue" && (
                      <button onClick={() => setFixed(n, !n.resolved_at)}
                        className="flex h-8 items-center gap-1.5 rounded-soft border border-[var(--border)] px-2.5 text-[12px] text-text hover:bg-[var(--surface-hover)]">
                        {n.resolved_at ? <><Undo2 size={13} /> Reopen</> : <><Check size={13} /> Mark fixed</>}
                      </button>
                    )}
                    <button onClick={() => remove(n)} aria-label="Remove note" title="Remove note"
                      className="flex h-8 w-8 items-center justify-center rounded-soft text-text-muted hover:bg-[var(--surface-hover)] hover:text-accent-red">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!list.length && <p className="px-3 py-10 text-center text-[13px] text-text-muted">Nothing here yet.</p>}
        </section>
      )}
      {tab === "issue" && fixedCount > 0 && (
        <button onClick={() => setShowFixed((v) => !v)} className="w-fit text-[12px] text-text-muted hover:text-text">
          {showFixed ? "Hide fixed problems" : `Show ${fixedCount} fixed`}
        </button>
      )}
    </div>
  );
}
