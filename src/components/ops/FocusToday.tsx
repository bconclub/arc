"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { dueLabel } from "@/lib/money";
import type { FocusTask, Project } from "@/types/ops";

/**
 * Focus tasks.
 *
 * A task used to be an entry inside a project's JSON, so writing one down meant
 * first inventing a project to hang it off. Most of what needs doing on a given
 * day belongs to no project at all, so these stand alone and a project is
 * something you may attach, not something you must.
 */
export function FocusToday({ projects }: { projects: Project[] }) {
  const [tasks, setTasks] = useState<FocusTask[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [projectId, setProjectId] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    // A failed load must not render as an empty list. "Nothing written down"
    // and "could not reach the database" look identical to you and mean
    // opposite things, so the failure is said out loud.
    fetch("/api/ops/tasks")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `Could not load tasks (${r.status}).`);
        return r.json();
      })
      .then((d) => { if (live) { setTasks(Array.isArray(d) ? d : []); setLoaded(true); } })
      .catch((e) => { if (live) { setError(e instanceof Error ? e.message : "Could not load tasks."); setLoaded(true); } });
    return () => { live = false; };
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ops/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, due: due || null, project_id: projectId || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Could not save that.");
      setTasks((prev) => [body, ...prev]);
      setText(""); setDue(""); setProjectId(""); setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(task: FocusTask) {
    // Optimistic, with the previous value kept so a failed write is undone
    // rather than leaving a tick the database never accepted.
    const next = !task.done;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: next } : t)));
    const res = await fetch(`/api/ops/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: next }),
    });
    if (!res.ok) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)));
      setError("That did not save.");
    }
  }

  async function remove(id: string) {
    const prev = tasks;
    setTasks((t) => t.filter((x) => x.id !== id));
    const res = await fetch(`/api/ops/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) { setTasks(prev); setError("Could not delete that."); }
  }

  const openTasks = tasks.filter((t) => !t.done);
  const doneToday = tasks.filter((t) => t.done).length;

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-panel border border-[var(--border)] bg-surface shadow-card">
      <div className="flex shrink-0 items-start justify-between gap-2 px-4 pt-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-text">Focus today</h2>
          <p className="mt-0.5 text-[11px] text-text-muted">
            {loaded ? `${openTasks.length} open${doneToday ? `, ${doneToday} done` : ""}` : "Loading."}
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex shrink-0 items-center gap-1 rounded-pill border border-[var(--border-strong)] px-2.5 py-1 text-[11.5px] font-medium text-text transition-colors hover:bg-[var(--glow-white)]"
        >
          {open ? <X size={12} /> : <Plus size={12} />} {open ? "Cancel" : "Add"}
        </button>
      </div>

      {open && (
        <form onSubmit={add} className="mx-4 mt-3 shrink-0 space-y-2 rounded-soft border border-[var(--border)] p-2.5">
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What needs doing?"
            className="w-full rounded-soft bg-[var(--surface-hover)] px-2.5 py-2 text-[12.5px] text-text outline-none placeholder:text-text-muted focus:ring-1 focus:ring-[var(--brand)]"
          />
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="min-w-0 flex-1 rounded-soft bg-[var(--surface-hover)] px-2.5 py-1.5 text-[11.5px] text-text outline-none"
            />
            {/* Optional on purpose: attaching a project is a convenience, never
                a precondition for writing the task down. */}
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="min-w-0 flex-1 rounded-soft bg-[var(--surface-hover)] px-2.5 py-1.5 text-[11.5px] text-text outline-none"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.client ? `${p.client} · ` : ""}{p.name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={!text.trim() || busy}
            className="flex w-full items-center justify-center gap-1.5 rounded-soft bg-[var(--brand)] px-3 py-2 text-[12px] font-semibold text-black transition-opacity disabled:opacity-40"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add task
          </button>
        </form>
      )}

      {error && <p className="mx-4 mt-2 shrink-0 text-[11px] text-accent-red">{error}</p>}

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {loaded && tasks.length === 0 && !open ? (
          <p className="px-2 py-8 text-center text-[12px] text-text-muted">
            {error ? "Tasks could not be loaded." : "Nothing written down. Press Add."}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {Array.from(tasks)
              .sort((a, b) => Number(a.done) - Number(b.done))
              .map((t) => {
                const d = dueLabel(t.due);
                const project = projects.find((p) => p.id === t.project_id);
                return (
                  <li key={t.id} className="group flex items-start gap-2.5 rounded-soft px-2 py-2 hover:bg-[var(--glow-white)]">
                    <button
                      onClick={() => toggle(t)}
                      aria-label={t.done ? "Mark not done" : "Mark done"}
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                        t.done ? "border-[var(--brand)] bg-[var(--brand)] text-black" : "border-[var(--border-strong)]"
                      }`}
                    >
                      {t.done && <Check size={11} strokeWidth={3} />}
                    </button>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[12.5px] leading-snug ${t.done ? "text-text-muted line-through" : "text-text"}`}>
                        {t.text}
                      </span>
                      {(project || t.due) && (
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10.5px] text-text-muted">
                          {project && <span className="truncate">{project.client ?? project.name}</span>}
                          {t.due && (
                            <span className={d.tone === "overdue" ? "text-accent-red" : d.tone === "soon" ? "text-accent-orange" : ""}>
                              {d.text}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => remove(t.id)}
                      aria-label="Delete task"
                      className="shrink-0 rounded p-1 text-text-muted opacity-0 transition-opacity hover:text-accent-red group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </section>
  );
}
