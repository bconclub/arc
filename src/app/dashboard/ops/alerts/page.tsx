"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Plus, Trash2 } from "lucide-react";
import { Modal, Field, ModalActions, inputCls, btnCls, btnPrimaryCls } from "@/components/ops/Modal";
import type { OpsSignal, OpsSignalSeverity } from "@/types/ops";

const SEV_DOT: Record<OpsSignalSeverity, string> = {
  critical: "bg-accent-red",
  high: "bg-accent-orange",
  warn: "bg-accent-orange",
  info: "bg-text-muted",
};

type FormState = { source: string; title: string; detail: string; severity: OpsSignalSeverity; url: string };
const EMPTY: FormState = { source: "", title: "", detail: "", severity: "info", url: "" };

export default function AlertsPage() {
  const [signals, setSignals] = useState<OpsSignal[]>([]);
  const [adding, setAdding] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await fetch("/api/ops/alerts").then((r) => r.json());
    setSignals(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleSeen(s: OpsSignal) {
    await fetch(`/api/ops/alerts/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seen: !s.seen }),
    });
    load();
  }

  async function remove(s: OpsSignal) {
    if (!confirm(`Delete alert "${s.title}"?`)) return;
    await fetch(`/api/ops/alerts/${s.id}`, { method: "DELETE" });
    load();
  }

  async function save() {
    if (!adding || !adding.title.trim()) { setError("Title is required."); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/ops/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adding),
    });
    setSaving(false);
    if (!res.ok) { setError("Save failed."); return; }
    setAdding(null); load();
  }

  return (
    <div className="page space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BellRing size={18} className="text-text-muted" />
          <h1 className="text-xl font-semibold tracking-tight text-text">Alerts</h1>
        </div>
        <button className={`${btnPrimaryCls} flex items-center gap-1.5`} onClick={() => { setError(""); setAdding({ ...EMPTY }); }}>
          <Plus size={13} /> New alert
        </button>
      </div>

      {signals.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--border)] px-6 py-10 text-center text-[13px] text-text-muted">
          No alerts yet. Any source can write here: a report, a webhook, a manual note.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-card border border-[var(--border)] bg-surface">
          {signals.map((s) => (
            <li key={s.id} className="flex items-start gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEV_DOT[s.severity]}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] ${s.seen ? "font-normal text-text-muted" : "font-semibold text-text"}`}>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{s.title}</a>
                  ) : s.title}
                </p>
                {s.detail && <p className="mt-0.5 text-[12px] text-text-muted">{s.detail}</p>}
                <p className="mt-1 text-[11px] tabular-nums text-text-muted">
                  {s.source || "manual"} · {new Date(s.ts).toLocaleString()}
                </p>
              </div>
              <button className={btnCls} onClick={() => toggleSeen(s)}>
                {s.seen ? "Mark unseen" : "Mark seen"}
              </button>
              <button className="mt-1.5 text-text-muted transition-colors hover:text-accent-red" onClick={() => remove(s)}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <Modal title="New alert" onClose={() => setAdding(null)}>
          <Field label="Title">
            <input className={inputCls} value={adding.title} autoFocus onChange={(e) => setAdding({ ...adding, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source">
              <input className={inputCls} value={adding.source} onChange={(e) => setAdding({ ...adding, source: e.target.value })} />
            </Field>
            <Field label="Severity">
              <select className={inputCls} value={adding.severity} onChange={(e) => setAdding({ ...adding, severity: e.target.value as OpsSignalSeverity })}>
                {["info", "warn", "high", "critical"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Detail">
            <textarea rows={2} className={inputCls} value={adding.detail} onChange={(e) => setAdding({ ...adding, detail: e.target.value })} />
          </Field>
          <Field label="Link (optional)">
            <input className={inputCls} value={adding.url} onChange={(e) => setAdding({ ...adding, url: e.target.value })} />
          </Field>
          {error && <p className="text-[12px] text-accent-red">{error}</p>}
          <ModalActions onCancel={() => setAdding(null)} onSave={save} saving={saving} />
        </Modal>
      )}
    </div>
  );
}
