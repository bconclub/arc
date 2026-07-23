"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Wallet, Plus } from "lucide-react";
import { Modal, Field, ModalActions, inputCls, btnPrimaryCls } from "@/components/ops/Modal";
import { money } from "@/lib/format";
import type { Payment, PaymentStatus } from "@/types/ops";

type FormState = { id?: string; client: string; item: string; amount: string; due: string; status: PaymentStatus };
const EMPTY: FormState = { client: "", item: "", amount: "", due: "", status: "pending" };

export default function MoneyPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await fetch("/api/ops/payments").then((r) => r.json());
    setPayments(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const sum = (list: Payment[]) => list.reduce((acc, r) => acc + (r.amount ?? 0), 0);
    const overdue = payments.filter((r) => r.status === "overdue");
    const pending = payments.filter((r) => ["pending", "invoiced"].includes(r.status));
    const paid = payments.filter((r) => r.status === "paid");
    return { overdue, pending, paid, sumOverdue: sum(overdue), sumPending: sum(pending), sumPaid: sum(paid) };
  }, [payments]);

  async function save() {
    if (!editing) return;
    setSaving(true); setError("");
    const res = await fetch(editing.id ? `/api/ops/payments/${editing.id}` : "/api/ops/payments", {
      method: editing.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setSaving(false);
    if (!res.ok) { setError("Save failed."); return; }
    setEditing(null); load();
  }

  async function remove() {
    if (!editing?.id || !confirm("Delete this payment row?")) return;
    setSaving(true);
    await fetch(`/api/ops/payments/${editing.id}`, { method: "DELETE" });
    setSaving(false); setEditing(null); load();
  }

  const statCards = [
    { n: money(stats.sumOverdue), l: `overdue (${stats.overdue.length})`, cls: "text-accent-red" },
    { n: money(stats.sumPending), l: `pending / invoiced (${stats.pending.length})`, cls: "text-text" },
    { n: money(stats.sumPaid), l: `paid (${stats.paid.length})`, cls: "text-accent-green" },
  ];

  return (
    <div className="space-y-6 px-1 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Wallet size={18} className="text-text-muted" />
          <h1 className="text-xl font-semibold tracking-tight text-text">Money</h1>
        </div>
        <button className={`${btnPrimaryCls} flex items-center gap-1.5`} onClick={() => { setError(""); setEditing({ ...EMPTY }); }}>
          <Plus size={13} /> New payment
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {statCards.map((s) => (
          <div key={s.l} className="rounded-card border border-[var(--border)] bg-surface p-4">
            <p className={`text-2xl font-bold tabular-nums tracking-tight ${s.cls}`}>{s.n}</p>
            <p className="mt-0.5 text-[11px] text-text-muted">{s.l}</p>
          </div>
        ))}
      </div>

      {payments.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--border)] px-6 py-10 text-center text-[13px] text-text-muted">
          No payments tracked.
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-[var(--border)] bg-surface">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-text-muted">
                {["client", "item", "amount", "due", "status"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="cursor-pointer border-t border-[var(--border)] transition-colors hover:bg-surface-hover"
                  onClick={() => { setError(""); setEditing({ id: p.id, client: p.client ?? "", item: p.item ?? "", amount: p.amount == null ? "" : String(p.amount), due: p.due ?? "", status: p.status }); }}>
                  <td className="px-4 py-2.5 font-medium text-text">{p.client || "—"}</td>
                  <td className="px-4 py-2.5 text-text-muted">{p.item || "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums text-text">{money(p.amount)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-text-muted">{p.due || "—"}</td>
                  <td className={`px-4 py-2.5 ${p.status === "overdue" ? "font-semibold text-accent-red" : "text-text-muted"}`}>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? "Edit payment" : "New payment"} onClose={() => setEditing(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client">
              <input className={inputCls} value={editing.client} autoFocus onChange={(e) => setEditing({ ...editing, client: e.target.value })} />
            </Field>
            <Field label="Item">
              <input className={inputCls} value={editing.item} onChange={(e) => setEditing({ ...editing, item: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)">
              <input type="number" className={inputCls} value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} />
            </Field>
            <Field label="Due date">
              <input type="date" className={inputCls} value={editing.due} onChange={(e) => setEditing({ ...editing, due: e.target.value })} />
            </Field>
          </div>
          <Field label="Status">
            <select className={inputCls} value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as PaymentStatus })}>
              {["pending", "invoiced", "overdue", "paid"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          {error && <p className="text-[12px] text-accent-red">{error}</p>}
          <ModalActions onDelete={remove} onCancel={() => setEditing(null)} onSave={save} saving={saving} canDelete={!!editing.id} />
        </Modal>
      )}
    </div>
  );
}
