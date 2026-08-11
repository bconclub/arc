"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Plus } from "lucide-react";
import { Modal, Field, ModalActions, inputCls, btnPrimaryCls } from "@/components/ops/Modal";
import type { Person } from "@/types/ops";

type FormState = { id?: string; name: string; role: string; org: string; relation: string; channel: string; notes: string };
const EMPTY: FormState = { name: "", role: "", org: "", relation: "", channel: "", notes: "" };

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await fetch("/api/ops/people").then((r) => r.json());
    setPeople(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!editing || !editing.name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError("");
    const res = await fetch(editing.id ? `/api/ops/people/${editing.id}` : "/api/ops/people", {
      method: editing.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setSaving(false);
    if (!res.ok) { setError("Save failed."); return; }
    setEditing(null); load();
  }

  async function remove() {
    if (!editing?.id || !confirm(`Delete "${editing.name}"?`)) return;
    setSaving(true);
    await fetch(`/api/ops/people/${editing.id}`, { method: "DELETE" });
    setSaving(false); setEditing(null); load();
  }

  return (
    <div className="page space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Users size={18} className="text-text-muted" />
          <h1 className="text-xl font-semibold tracking-tight text-text">People</h1>
        </div>
        <button className={`${btnPrimaryCls} flex items-center gap-1.5`} onClick={() => { setError(""); setEditing({ ...EMPTY }); }}>
          <Plus size={13} /> New person
        </button>
      </div>

      {people.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--border)] px-6 py-10 text-center text-[13px] text-text-muted">
          No people yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-[var(--border)] bg-surface">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-text-muted">
                {["person", "role", "org", "relation", "channel"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="cursor-pointer border-t border-[var(--border)] transition-colors hover:bg-surface-hover"
                  onClick={() => { setError(""); setEditing({ id: p.id, name: p.name, role: p.role ?? "", org: p.org ?? "", relation: p.relation ?? "", channel: p.channel ?? "", notes: p.notes ?? "" }); }}>
                  <td className="px-4 py-2.5 font-medium text-text">{p.name}</td>
                  <td className="px-4 py-2.5 text-text-muted">{p.role || "-"}</td>
                  <td className="px-4 py-2.5 text-text-muted">{p.org || "-"}</td>
                  <td className="px-4 py-2.5 text-text-muted">{p.relation || "-"}</td>
                  <td className="px-4 py-2.5 text-text-muted">{p.channel || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? "Edit person" : "New person"} onClose={() => setEditing(null)}>
          <Field label="Name">
            <input className={inputCls} value={editing.name} autoFocus onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role">
              <input className={inputCls} value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} />
            </Field>
            <Field label="Org">
              <input className={inputCls} value={editing.org} onChange={(e) => setEditing({ ...editing, org: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Relation">
              <input className={inputCls} value={editing.relation} onChange={(e) => setEditing({ ...editing, relation: e.target.value })} />
            </Field>
            <Field label="Channel">
              <input className={inputCls} value={editing.channel} onChange={(e) => setEditing({ ...editing, channel: e.target.value })} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea rows={3} className={inputCls} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          </Field>
          {error && <p className="text-[12px] text-accent-red">{error}</p>}
          <ModalActions onDelete={remove} onCancel={() => setEditing(null)} onSave={save} saving={saving} canDelete={!!editing.id} />
        </Modal>
      )}
    </div>
  );
}
