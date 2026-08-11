"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Plus } from "lucide-react";
import { Modal, Field, ModalActions, inputCls, btnPrimaryCls } from "@/components/ops/Modal";
import { money, daysAgo } from "@/lib/format";
import type { Proposal, ProposalStatus } from "@/types/ops";

const ORDER: ProposalStatus[] = ["discussing", "sent", "draft", "won", "lost"];

type FormState = { id?: string; name: string; client: string; amount: string; status: ProposalStatus; sent: string; notes: string };
const EMPTY: FormState = { name: "", client: "", amount: "", status: "draft", sent: "", notes: "" };

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await fetch("/api/ops/proposals").then((r) => r.json());
    setProposals(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(
    () => [...proposals].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)),
    [proposals]
  );

  async function save() {
    if (!editing || !editing.name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError("");
    const res = await fetch(editing.id ? `/api/ops/proposals/${editing.id}` : "/api/ops/proposals", {
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
    await fetch(`/api/ops/proposals/${editing.id}`, { method: "DELETE" });
    setSaving(false); setEditing(null); load();
  }

  return (
    <div className="page space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FileText size={18} className="text-text-muted" />
          <h1 className="text-xl font-semibold tracking-tight text-text">Proposals</h1>
        </div>
        <button className={`${btnPrimaryCls} flex items-center gap-1.5`} onClick={() => { setError(""); setEditing({ ...EMPTY }); }}>
          <Plus size={13} /> New proposal
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--border)] px-6 py-10 text-center text-[13px] text-text-muted">
          No proposals yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-[var(--border)] bg-surface">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-text-muted">
                {["proposal", "client", "amount", "status", "sent"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id} className="cursor-pointer border-t border-[var(--border)] transition-colors hover:bg-surface-hover"
                  onClick={() => { setError(""); setEditing({ id: p.id, name: p.name, client: p.client ?? "", amount: p.amount == null ? "" : String(p.amount), status: p.status, sent: p.sent ?? "", notes: p.notes ?? "" }); }}>
                  <td className="px-4 py-2.5 font-medium text-text">{p.name}</td>
                  <td className="px-4 py-2.5 text-text-muted">{p.client || "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums text-text">{money(p.amount)}</td>
                  <td className="px-4 py-2.5 text-text-muted">{p.status}</td>
                  <td className="px-4 py-2.5 tabular-nums text-text-muted">{p.sent ? daysAgo(p.sent) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? "Edit proposal" : "New proposal"} onClose={() => setEditing(null)}>
          <Field label="Name">
            <input className={inputCls} value={editing.name} autoFocus onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client">
              <input className={inputCls} value={editing.client} onChange={(e) => setEditing({ ...editing, client: e.target.value })} />
            </Field>
            <Field label="Amount (₹)">
              <input type="number" className={inputCls} value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select className={inputCls} value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as ProposalStatus })}>
                {["draft", "sent", "discussing", "won", "lost"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Sent date">
              <input type="date" className={inputCls} value={editing.sent} onChange={(e) => setEditing({ ...editing, sent: e.target.value })} />
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
