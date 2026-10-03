"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, Landmark } from "lucide-react";
import { Modal, Field, ModalActions, inputCls, btnPrimaryCls, btnCls } from "@/components/ops/Modal";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { StatusPill } from "@/components/ui/StatusPill";
import { money } from "@/lib/format";

type FieldType = "text" | "textarea" | "number" | "date" | "datetime" | "select" | "password" | "checkbox";
type FieldDef = { key: string; label: string; type: FieldType; options?: string[]; placeholder?: string; createOnly?: boolean };
type Col = { key: string; label: string; render?: (row: Row) => React.ReactNode };
type Row = Record<string, unknown> & { id: string };

type TabKey = "investors" | "updates" | "demos" | "expenses";

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (v: unknown) => (v == null || v === "" ? "–" : String(v));
const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "–");
const fmtDT = (v: unknown) => (v ? new Date(String(v)).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "–");

/** datetime-local wants local "YYYY-MM-DDTHH:mm"; the API stores ISO. */
function toLocalInput(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const CONFIG: Record<TabKey, {
  label: string;
  noun: string;
  fields: FieldDef[];
  cols: Col[];
  blank: () => Record<string, unknown>;
  canDelete: boolean;
}> = {
  investors: {
    label: "Investors",
    noun: "investor",
    canDelete: false,
    blank: () => ({ username: "", name: "", email: "", password: "", round: "Pre-seed", committed_amount: "", received_amount: "", equity_pct: "", invested_on: today(), active: true }),
    fields: [
      { key: "name", label: "Full name", type: "text" },
      { key: "username", label: "Username (they sign in with this)", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "password", label: "Password (10+ chars; leave blank to keep)", type: "password" },
      { key: "round", label: "Round", type: "select", options: ["Pre-seed", "Seed", "Angel", "Bridge"] },
      { key: "committed_amount", label: "Promised (₹)", type: "number" },
      { key: "received_amount", label: "Actually received (₹)", type: "number" },
      { key: "equity_pct", label: "Equity stake (%)", type: "number" },
      { key: "invested_on", label: "Money landed on", type: "date" },
      { key: "active", label: "Can sign in", type: "checkbox" },
    ],
    cols: [
      { key: "name", label: "Investor" },
      { key: "username", label: "Username" },
      { key: "round", label: "Round", render: (r) => fmt(r.round) },
      { key: "committed_amount", label: "Promised", render: (r) => money(r.committed_amount as number) },
      { key: "received_amount", label: "Received", render: (r) => money(r.received_amount as number) },
      { key: "equity_pct", label: "Equity", render: (r) => (r.equity_pct == null ? "–" : `${r.equity_pct}%`) },
      { key: "invested_on", label: "Since", render: (r) => fmtDate(r.invested_on) },
      { key: "last_login_at", label: "Last seen", render: (r) => fmtDT(r.last_login_at) },
      { key: "active", label: "Access", render: (r) => <StatusPill status={r.active ? "active" : "disabled"} tone={r.active ? "good" : "neutral"} /> },
    ],
  },
  updates: {
    label: "Updates",
    noun: "update",
    canDelete: true,
    blank: () => ({ title: "", body_md: "", kind: "note", stage: "done", daily_budget: "", targeting: "", published: true, pinned: false }),
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "kind", label: "Kind", type: "select", options: ["ads", "milestone", "metric", "product", "hiring", "risk", "note"] },
      { key: "stage", label: "Stage", type: "select", options: ["plan", "executing", "done"] },
      { key: "body_md", label: "What is happening", type: "textarea" },
      { key: "daily_budget", label: "Ads only: daily budget (₹)", type: "number" },
      { key: "targeting", label: "Ads only: targeting (who, where, age, interests, placements)", type: "textarea" },
      { key: "published", label: "Visible to investors", type: "checkbox" },
      { key: "pinned", label: "Pin to top of feed", type: "checkbox" },
    ],
    cols: [
      { key: "title", label: "Title" },
      { key: "kind", label: "Kind", render: (r) => <StatusPill status={String(r.kind)} /> },
      { key: "stage", label: "Stage", render: (r) => fmt(r.stage) },
      { key: "published_at", label: "Posted", render: (r) => fmtDate(r.published_at) },
      { key: "published", label: "Visible", render: (r) => (r.published ? "Yes" : "Draft") },
    ],
  },
  demos: {
    label: "Demos",
    noun: "demo",
    canDelete: true,
    blank: () => ({ company: "", contact: "", scheduled_at: toLocalInput(new Date().toISOString()), status: "scheduled", outcome: "", source: "outreach", notes: "" }),
    fields: [
      { key: "company", label: "Company", type: "text" },
      { key: "contact", label: "Who", type: "text" },
      { key: "scheduled_at", label: "When", type: "datetime" },
      { key: "status", label: "Status", type: "select", options: ["scheduled", "done", "no_show", "cancelled"] },
      { key: "outcome", label: "Outcome (after a done demo)", type: "select", options: ["", "interested", "trial", "won", "lost", "follow_up"] },
      { key: "source", label: "Source", type: "select", options: ["outreach", "inbound", "referral", "event"] },
      { key: "notes", label: "Notes (not shown to investors)", type: "textarea" },
    ],
    cols: [
      { key: "company", label: "Company" },
      { key: "scheduled_at", label: "When", render: (r) => fmtDT(r.scheduled_at) },
      { key: "status", label: "Status", render: (r) => <StatusPill status={String(r.status)} /> },
      { key: "outcome", label: "Outcome", render: (r) => fmt(r.outcome) },
      { key: "source", label: "Source" },
    ],
  },
  expenses: {
    label: "Spend",
    noun: "expense",
    canDelete: true,
    blank: () => ({ spent_on: today(), category: "tools", vendor: "", description: "", amount: "", recurring: false }),
    fields: [
      { key: "spent_on", label: "Date", type: "date" },
      { key: "category", label: "Category", type: "select", options: ["ad_topup", "tools", "infra", "calls", "people", "marketing", "legal", "other"] },
      { key: "vendor", label: "Vendor", type: "text", placeholder: "ElevenLabs, Vobiz, Vercel…" },
      { key: "description", label: "What for", type: "text" },
      { key: "amount", label: "Amount (₹)", type: "number" },
      { key: "daily_budget", label: "Daily ad budget (ad top-ups only)", type: "number" },
      { key: "recurring", label: "Monthly subscription", type: "checkbox" },
    ],
    cols: [
      { key: "spent_on", label: "Date", render: (r) => fmtDate(r.spent_on) },
      { key: "category", label: "Category" },
      { key: "vendor", label: "Vendor", render: (r) => fmt(r.vendor) },
      { key: "description", label: "What", render: (r) => fmt(r.description) },
      { key: "amount", label: "Amount", render: (r) => money(r.amount as number) },
    ],
  },
};

export default function InvestorsAdminPage() {
  const [tab, setTab] = useState<TabKey>("investors");
  const [rows, setRows] = useState<Row[]>([]);
  const [detail, setDetail] = useState("");
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const cfg = CONFIG[tab];

  const load = useCallback(async () => {
    const res = await fetch(`/api/ops/investor-admin/${tab}`).then((r) => r.json()).catch(() => ({}));
    setRows(Array.isArray(res.items) ? res.items : []);
    setDetail(res.detail ?? "");
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  function open(row?: Row) {
    setError("");
    if (!row) { setEditing(cfg.blank()); return; }
    const copy: Record<string, unknown> = { ...row };
    const payload = (row.payload ?? {}) as { daily_budget?: number | null; targeting?: string | null };
    if (tab === "updates") {
      copy.daily_budget = payload.daily_budget ?? "";
      copy.targeting = payload.targeting ?? "";
    }
    for (const f of cfg.fields) {
      if (f.type === "datetime") copy[f.key] = toLocalInput(row[f.key]);
      if (f.type === "password") copy[f.key] = "";
      if (copy[f.key] == null) copy[f.key] = "";
    }
    setEditing(copy);
  }

  async function save() {
    if (!editing) return;
    setSaving(true); setError("");
    const body: Record<string, unknown> = {};
    for (const f of cfg.fields) {
      let v = editing[f.key];
      if (f.type === "datetime" && v) v = new Date(String(v)).toISOString();
      if (f.type === "password" && !v) continue;
      body[f.key] = v;
    }
    const id = editing.id as string | undefined;
    const res = await fetch(id ? `/api/ops/investor-admin/${tab}/${id}` : `/api/ops/investor-admin/${tab}`, {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "Save failed."); return; }
    setEditing(null); load();
  }

  async function remove() {
    const id = editing?.id as string | undefined;
    if (!id || !confirm(`Delete this ${cfg.noun}?`)) return;
    setSaving(true);
    await fetch(`/api/ops/investor-admin/${tab}/${id}`, { method: "DELETE" });
    setSaving(false); setEditing(null); load();
  }

  return (
    <div className="mx-auto max-w-dashboard space-y-5 px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Landmark size={18} className="text-[var(--brand-text)]" />
            <h1 className="text-[22px] font-semibold tracking-tight text-text">Investors</h1>
          </div>
          <p className="mt-1 text-[12.5px] text-text-muted">
            Who can see the PROXe investor view, and what goes into it: updates, demos and money out.
            Ad spend comes from Meta on its own.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/investor" target="_blank" className={`${btnCls} flex items-center gap-1.5`}>
            <ExternalLink size={13} /> Preview investor view
          </Link>
          <button className={`${btnPrimaryCls} flex items-center gap-1.5`} onClick={() => open()}>
            <Plus size={13} /> Add {cfg.noun}
          </button>
        </div>
      </header>

      <SegmentedTabs
        ariaLabel="Section"
        value={tab}
        onChange={(v) => { setTab(v); setRows([]); }}
        tabs={(Object.keys(CONFIG) as TabKey[]).map((k) => ({ value: k, label: CONFIG[k].label }))}
      />

      {detail && <p className="text-[12px] text-accent-orange">{detail}</p>}

      <div className="overflow-x-auto rounded-panel border border-[var(--border)] bg-surface">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-text-muted">
              {cfg.cols.map((c) => <th key={c.key} className="px-4 py-2.5 font-semibold">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={cfg.cols.length} className="px-4 py-10 text-center text-[12px] text-text-muted">Nothing here yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} onClick={() => open(r)} className="cursor-pointer border-t border-[var(--border)] transition-colors hover:bg-surface-hover">
                {cfg.cols.map((c) => (
                  <td key={c.key} className="px-4 py-2.5 text-text">{c.render ? c.render(r) : fmt(r[c.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={`${editing.id ? "Edit" : "New"} ${cfg.noun}`} onClose={() => setEditing(null)}>
          {cfg.fields.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.type === "textarea" ? (
                <textarea
                  rows={5}
                  className={inputCls}
                  value={String(editing[f.key] ?? "")}
                  onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                />
              ) : f.type === "select" ? (
                <select
                  className={inputCls}
                  value={String(editing[f.key] ?? "")}
                  onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                >
                  {f.options!.map((o) => <option key={o} value={o}>{o || "–"}</option>)}
                </select>
              ) : f.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={Boolean(editing[f.key])}
                  onChange={(e) => setEditing({ ...editing, [f.key]: e.target.checked })}
                />
              ) : (
                <input
                  type={f.type === "datetime" ? "datetime-local" : f.type === "password" ? "password" : f.type}
                  autoComplete={f.type === "password" ? "new-password" : "off"}
                  placeholder={f.placeholder}
                  className={inputCls}
                  value={String(editing[f.key] ?? "")}
                  onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}
                />
              )}
            </Field>
          ))}
          {error && <p className="mt-2 text-[12px] text-accent-red">{error}</p>}
          <ModalActions
            onCancel={() => setEditing(null)}
            onSave={save}
            onDelete={remove}
            saving={saving}
            canDelete={Boolean(editing.id) && cfg.canDelete}
          />
        </Modal>
      )}
    </div>
  );
}
