"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderKanban, Plus, X } from "lucide-react";
import { Modal, Field, ModalActions, inputCls, btnCls, btnPrimaryCls } from "@/components/ops/Modal";
import { money } from "@/lib/format";
import type { Project, ProjectStatus, ProjectSize, OpsTask } from "@/types/ops";

const STATUS_ORDER: ProjectStatus[] = ["active", "waiting", "parked", "done"];
const STATUS_COLOR: Record<ProjectStatus, string> = {
  active: "text-accent-green",
  waiting: "text-accent-orange",
  parked: "text-text-muted",
  done: "text-text-muted",
};

type FormState = {
  id?: string;
  name: string;
  client: string;
  status: ProjectStatus;
  next: string;
  start_date: string;
  end_date: string;
  budget: string;
  size: ProjectSize | "";
  progress: number;
  tasks: OpsTask[];
};

const EMPTY: FormState = {
  name: "", client: "", status: "active", next: "", start_date: "", end_date: "",
  budget: "", size: "", progress: 0, tasks: [],
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await fetch("/api/ops/projects").then((r) => r.json());
    setProjects(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(
    () => [...projects].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)),
    [projects]
  );

  function openEdit(p: Project) {
    setError("");
    setEditing({
      id: p.id, name: p.name, client: p.client ?? "", status: p.status, next: p.next ?? "",
      start_date: p.start_date ?? "", end_date: p.end_date ?? "",
      budget: p.budget == null ? "" : String(p.budget), size: p.size ?? "",
      progress: p.progress ?? 0, tasks: p.tasks ?? [],
    });
  }

  async function save() {
    if (!editing || !editing.name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError("");
    const res = await fetch(editing.id ? `/api/ops/projects/${editing.id}` : "/api/ops/projects", {
      method: editing.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setSaving(false);
    if (!res.ok) { setError("Save failed."); return; }
    setEditing(null); load();
  }

  async function remove() {
    if (!editing?.id) return;
    if (!confirm(`Delete "${editing.name}"? This can't be undone.`)) return;
    setSaving(true);
    const res = await fetch(`/api/ops/projects/${editing.id}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) { setError("Delete failed."); return; }
    setEditing(null); load();
  }

  function setTask(i: number, patch: Partial<OpsTask>) {
    if (!editing) return;
    setEditing({ ...editing, tasks: editing.tasks.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  }

  return (
    <div className="page space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FolderKanban size={18} className="text-text-muted" />
          <h1 className="text-xl font-semibold tracking-tight text-text">Projects</h1>
        </div>
        <button className={`${btnPrimaryCls} flex items-center gap-1.5`} onClick={() => { setError(""); setEditing({ ...EMPTY }); }}>
          <Plus size={13} /> New project
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--border)] px-6 py-10 text-center text-[13px] text-text-muted">
          No projects yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((p) => {
            const open = (p.tasks ?? []).filter((t) => !t.done).length;
            const done = (p.tasks ?? []).filter((t) => t.done).length;
            return (
              <button
                key={p.id}
                onClick={() => openEdit(p)}
                className="rounded-card border border-[var(--border)] bg-surface p-4 text-left transition-all hover:border-[var(--border-strong)] hover:bg-surface-hover"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-text">{p.name}</span>
                  {p.client && (
                    <span className="whitespace-nowrap rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-text-muted">
                      {p.client}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[12px] text-text-muted">
                  next: <span className="text-text">{p.next || "-"}</span>
                </p>
                <p className="mt-0.5 text-[12px] text-text-muted">
                  {open} open · {done} done
                  {p.size && ` · ${p.size}`}
                  {p.budget != null && ` · ${money(p.budget)}`}
                </p>
                {(p.start_date || p.end_date) && (
                  <p className="mt-0.5 text-[12px] tabular-nums text-text-muted">
                    {p.start_date || "?"} → {p.end_date || "?"}
                  </p>
                )}
                <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[var(--border)]">
                  <div className="h-full rounded-full bg-text" style={{ width: `${Math.max(0, Math.min(100, p.progress))}%` }} />
                </div>
                <p className={`mt-2 text-[12px] font-medium ${STATUS_COLOR[p.status]}`}>● {p.status}</p>
              </button>
            );
          })}
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? "Edit project" : "New project"} onClose={() => setEditing(null)}>
          <Field label="Name">
            <input className={inputCls} value={editing.name} autoFocus onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client">
              <input className={inputCls} value={editing.client} onChange={(e) => setEditing({ ...editing, client: e.target.value })} />
            </Field>
            <Field label="Status">
              <select className={inputCls} value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as ProjectStatus })}>
                {STATUS_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Next action">
            <input className={inputCls} value={editing.next} onChange={(e) => setEditing({ ...editing, next: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input type="date" className={inputCls} value={editing.start_date} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} />
            </Field>
            <Field label="End date">
              <input type="date" className={inputCls} value={editing.end_date} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Budget (₹)">
              <input type="number" className={inputCls} value={editing.budget} onChange={(e) => setEditing({ ...editing, budget: e.target.value })} />
            </Field>
            <Field label="Size">
              <select className={inputCls} value={editing.size} onChange={(e) => setEditing({ ...editing, size: e.target.value as ProjectSize })}>
                <option value="">-</option>
                {["S", "M", "L", "XL"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label={`Progress: ${editing.progress}%`}>
            <input type="range" min={0} max={100} className="w-full accent-[var(--text)]" value={editing.progress}
              onChange={(e) => setEditing({ ...editing, progress: Number(e.target.value) })} />
          </Field>
          <Field label="Tasks">
            <div className="space-y-2">
              {editing.tasks.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="checkbox" checked={t.done} onChange={(e) => setTask(i, { done: e.target.checked })} className="accent-[var(--text)]" />
                  <input className={inputCls} value={t.text} placeholder="task" onChange={(e) => setTask(i, { text: e.target.value })} />
                  <input type="date" className={`${inputCls} w-36 shrink-0`} value={t.due ?? ""} onChange={(e) => setTask(i, { due: e.target.value || null })} />
                  <button className="text-text-muted hover:text-accent-red" onClick={() => setEditing({ ...editing, tasks: editing.tasks.filter((_, idx) => idx !== i) })}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button className={btnCls} onClick={() => setEditing({ ...editing, tasks: [...editing.tasks, { text: "", done: false, due: null }] })}>
                + Add task
              </button>
            </div>
          </Field>
          {error && <p className="text-[12px] text-accent-red">{error}</p>}
          <ModalActions onDelete={remove} onCancel={() => setEditing(null)} onSave={save} saving={saving} canDelete={!!editing.id} />
        </Modal>
      )}
    </div>
  );
}
