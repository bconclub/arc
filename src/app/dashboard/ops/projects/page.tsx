"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderKanban, Plus, X } from "lucide-react";
import { Modal, Field, ModalActions, inputCls, btnCls, btnPrimaryCls } from "@/components/ops/Modal";
import { money, deliverableOf } from "@/lib/format";
import { dueLabel } from "@/lib/money";
import { BrandMark } from "@/components/ops/BrandMark";
import { StatusPill } from "@/components/ui/StatusPill";
import { ProjectTimeline } from "@/components/ops/ProjectTimeline";
import type { Brand, Person, Project, ProjectStatus, ProjectSize, OpsTask } from "@/types/ops";

const STATUS_ORDER: ProjectStatus[] = ["active", "waiting", "parked", "done"];

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
  const [brands, setBrands] = useState<Brand[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [b, pl] = await Promise.all([
      fetch("/api/ops/brands").then((r) => r.json()).catch(() => []),
      fetch("/api/ops/people").then((r) => r.json()).catch(() => []),
    ]);
    setBrands(Array.isArray(b) ? b : []);
    setPeople(Array.isArray(pl) ? pl : []);
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

  // Projects hold the client as free text, so the brand has to be resolved by
  // name to get a logo and its contacts.
  const brandOf = useMemo(() => {
    const key = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
    const m = new Map<string, Brand>();
    for (const b of brands) {
      m.set(key(b.name), b);
      for (const a of b.aliases ?? []) m.set(key(a), b);
    }
    return (client: string | null) => (client ? m.get(key(client)) : undefined);
  }, [brands]);

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

      {/* What is running now and what lands soon, before the detail below. */}
      <ProjectTimeline projects={projects} brands={brands} onOpen={openEdit} />

      {sorted.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--border)] px-6 py-10 text-center text-[13px] text-text-muted">
          No projects yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((p) => {
            const open = (p.tasks ?? []).filter((t) => !t.done).length;
            const done = (p.tasks ?? []).filter((t) => t.done).length;
            const total = open + done;
            const brand = brandOf(p.client);
            const contacts = people.filter((x) => (brand && x.brand_id === brand.id));
            const end = dueLabel(p.end_date);
            const progress = Math.max(0, Math.min(100, p.progress ?? 0));
            const late = end.days != null && end.days < 0 && p.status !== "done";
            return (
              <button
                key={p.id}
                onClick={() => openEdit(p)}
                className="metric-card flex flex-col rounded-card border border-[var(--border)] bg-surface p-3.5 text-left"
              >
                <div className="flex items-start gap-2.5">
                  <BrandMark
                    name={p.client ?? p.name}
                    logoUrl={brand?.logo_url}
                    color={brand?.color}
                    size={40}
                    radius="rounded-lg"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold leading-tight text-text" title={p.name}>
                      {deliverableOf(p.name, p.client)}
                    </span>
                    <span className="block truncate text-[11px] text-text-muted">{p.client ?? "No client"}</span>
                    <StatusPill status={late ? "overdue" : p.status} className="mt-1" />
                  </span>
                </div>

                {p.next && (
                  <p className="mt-2.5 line-clamp-2 text-[11.5px] leading-snug text-text">
                    <span className="text-text-muted">Next: </span>{p.next}
                  </p>
                )}

                <div className="mt-2.5 h-1.5 overflow-hidden rounded-pill bg-[var(--surface-hover)]">
                  <div
                    className="h-full rounded-pill transition-all"
                    style={{ width: `${progress}%`, background: late ? "#e5484d" : "var(--brand)" }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-text-muted">
                  <span className="tabular-nums">
                    {progress}%{total > 0 && ` · ${open}/${total} tasks`}
                  </span>
                  {/* An absent end date is said plainly rather than left blank,
                      where it reads as a date that failed to load. */}
                  <span className={late ? "font-medium text-accent-red" : ""}>
                    {p.end_date ? end.text : "No end date"}
                  </span>
                </div>

                {(contacts.length > 0 || p.budget != null || p.size) && (
                  <div className="mt-2.5 flex items-center gap-2 border-t border-[var(--border)] pt-2">
                    {contacts.slice(0, 3).map((c, i) => (
                      <span
                        key={c.id}
                        title={`${c.name}${c.role ? ` · ${c.role}` : ""}`}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[8.5px] font-semibold text-text-muted"
                        style={{ marginLeft: i ? -8 : 0 }}
                      >
                        {c.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                      </span>
                    ))}
                    {contacts.length > 3 && (
                      <span className="text-[10px] text-text-muted">+{contacts.length - 3}</span>
                    )}
                    <span className="ml-auto text-[10.5px] tabular-nums text-text-muted">
                      {p.budget != null ? money(p.budget) : p.size ?? ""}
                    </span>
                  </div>
                )}
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
