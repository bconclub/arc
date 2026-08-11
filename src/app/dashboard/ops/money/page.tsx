"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Plus, Wallet } from "lucide-react";
import { Modal, Field, ModalActions, inputCls, btnPrimaryCls } from "@/components/ops/Modal";
import { SegmentedTabs, type Tab } from "@/components/ui/SegmentedTabs";
import { FilterBar, countActive, type SelectFilter } from "@/components/ui/FilterBar";
import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { MasterDetail } from "@/components/ui/MasterDetail";
import { StatusPill } from "@/components/ui/StatusPill";
import { InvoiceDetail } from "@/components/money/InvoiceDetail";
import { money } from "@/lib/format";
import { dueLabel, receivables } from "@/lib/money";
import { brandIndex } from "@/lib/rollup";
import { BrandMark } from "@/components/ops/BrandMark";
import type { Brand, Payment, PaymentStatus } from "@/types/ops";

type FormState = { id?: string; client: string; item: string; amount: string; due: string; status: PaymentStatus };
const EMPTY: FormState = { client: "", item: "", amount: "", due: "", status: "pending" };

type TabKey = "all" | PaymentStatus;

const MONTH_FMT = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" });

export default function MoneyPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  // Loaded so an invoice can show its client's logo, and so the detail
  // panel can offer every brand when reassigning one.
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [tab, setTab] = useState<TabKey>("all");
  const [client, setClient] = useState("");
  const [month, setMonth] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const j = (u: string) => fetch(u).then((r) => r.json()).catch(() => []);
    const [data, br] = await Promise.all([j("/api/ops/payments"), j("/api/ops/brands")]);
    setPayments(Array.isArray(data) ? data : []);
    setBrands(Array.isArray(br) ? br : []);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const r = useMemo(() => receivables(payments), [payments]);
  const brandOf = useMemo(() => brandIndex(brands), [brands]);

  const stats: Stat[] = useMemo(() => [
    {
      key: "overdue",
      label: "Overdue",
      value: money(r.overdueTotal),
      hint: `${r.overdueRows.length} invoice${r.overdueRows.length === 1 ? "" : "s"}`,
      icon: AlertTriangle,
      valueClass: r.overdueTotal > 0 ? "text-accent-red" : "text-text",
    },
    {
      key: "soon",
      label: "Due within a month",
      value: money(r.dueWithinMonth),
      hint: "Not yet overdue",
      icon: CalendarClock,
    },
    {
      key: "outstanding",
      label: "Total outstanding",
      value: money(r.total),
      // Whenever an unpaid invoice has no amount, the total is an undercount.
      // Saying so is the difference between a figure and a misleading figure.
      hint: r.unpricedCount > 0
        ? `${r.unpricedCount} invoice${r.unpricedCount === 1 ? "" : "s"} with no amount recorded`
        : `${r.unpaid.length} unpaid`,
      icon: Wallet,
      valueClass: r.unpricedCount > 0 ? "text-accent-orange" : "text-text",
    },
    {
      key: "collected",
      label: "Collected",
      value: money(r.collected),
      hint: `${r.paidRows.length} paid`,
      icon: CheckCircle2,
      valueClass: "text-accent-green",
    },
    {
      key: "speed",
      label: "Average time to get paid",
      // Null until paid dates exist. Showing "Not recorded" is the honest state:
      // the alternative is averaging due dates, which measures when we asked to
      // be paid rather than when we were.
      value: r.daysToPay.average == null ? "Not recorded" : `${r.daysToPay.average} days`,
      hint: r.daysToPay.average == null
        ? `No paid dates on ${r.daysToPay.missing} paid invoice${r.daysToPay.missing === 1 ? "" : "s"}`
        : r.daysToPay.missing > 0
          ? `From ${r.daysToPay.measured} of ${r.paidRows.length} paid invoices`
          : `Across ${r.daysToPay.measured} paid invoices`,
      icon: Clock,
      valueClass: r.daysToPay.average == null ? "text-text-muted" : "text-text",
    },
  ], [r]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of payments) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [payments]);

  const tabs: Tab<TabKey>[] = [
    { value: "all", label: "All", count: payments.length },
    ...(["overdue", "invoiced", "pending", "paid"] as PaymentStatus[])
      .filter((s) => counts[s])
      .map((s) => ({ value: s as TabKey, label: s[0].toUpperCase() + s.slice(1), count: counts[s] })),
  ];

  const clients = useMemo(
    () => Array.from(new Set(payments.map((p) => p.client).filter((c): c is string => !!c))).sort(),
    [payments],
  );

  const months = useMemo(() => {
    const keys = new Set<string>();
    for (const p of payments) if (p.due) keys.add(p.due.slice(0, 7));
    return Array.from(keys).sort().reverse();
  }, [payments]);

  const filters: SelectFilter[] = [
    { key: "client", label: "All clients", value: client, onChange: setClient,
      options: clients.map((c) => ({ value: c, label: c })) },
    { key: "month", label: "Any month", value: month, onChange: setMonth,
      options: months.map((m) => ({ value: m, label: MONTH_FMT.format(new Date(m + "-01T00:00:00")) })) },
  ];

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (tab !== "all" && p.status !== tab) return false;
      if (client && p.client !== client) return false;
      if (month && (p.due ?? "").slice(0, 7) !== month) return false;
      if (q && !`${p.client ?? ""} ${p.item ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [payments, tab, client, month, search]);

  const selected = visible.find((p) => p.id === selectedId) ?? null;

  function clearFilters() { setClient(""); setMonth(""); setSearch(""); }

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
    setSaving(false); setEditing(null); setSelectedId(null); load();
  }

  const listPane = (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-panel border border-[var(--border)] bg-surface shadow-card">
      <div className="shrink-0 border-b border-[var(--border)] px-3 py-2.5">
        <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} size="sm" ariaLabel="Filter by status" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-[12.5px] text-text-muted">
            {payments.length === 0
              ? "No invoices tracked yet."
              : countActive(filters, search) > 0 || tab !== "all"
                // Distinguishing these matters: an empty filtered list otherwise
                // reads as "you have no money owed".
                ? "No invoices match these filters."
                : "Nothing here."}
          </p>
        ) : (
          visible.map((p) => {
            const d = dueLabel(p.due);
            const active = p.id === selectedId;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`flex w-full items-center gap-3 border-b border-[var(--border)] px-3 py-2.5 text-left transition-colors last:border-b-0 ${
                  active ? "bg-[var(--brand-faint)]" : "hover:bg-[var(--surface-hover)]"
                }`}
              >
                <BrandMark
                  name={p.client || "Unnamed"}
                  logoUrl={brandOf(p.client)?.logo_url}
                  color={brandOf(p.client)?.color}
                  size={28}
                  radius="rounded-md"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-text">{p.client || "Unnamed"}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted">
                    {/* The due label must not wrap: in a narrow column "No due
                        date" broke across three lines and pushed the row height
                        out of step with its neighbours. */}
                    <span className={`shrink-0 whitespace-nowrap ${d.tone === "overdue" ? "text-accent-red" : ""}`}>
                      {d.text}
                    </span>
                    {p.item && <span className="min-w-0 truncate">· {p.item}</span>}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`text-[13px] font-semibold tabular-nums ${p.amount == null ? "text-accent-orange" : "text-text"}`}>
                    {p.amount == null ? "No amount" : money(p.amount)}
                  </span>
                  <StatusPill status={p.status} />
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    // Height is pinned only from `lg`, where the panes scroll internally. Below
    // that the page scrolls normally, since the layout already reserves pb-20
    // for the bottom nav and two panes side by side are unusable on a phone.
    <div className="flex flex-col gap-3 px-4 pb-4 pt-4 sm:px-5 lg:h-[100dvh] lg:px-6">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Wallet size={19} className="text-text-muted" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text">Invoices</h1>
            <p className="mt-0.5 text-[12.5px] text-text-muted">What is owed, what is overdue, what has landed</p>
          </div>
        </div>
        <button
          className={`${btnPrimaryCls} flex items-center gap-1.5`}
          onClick={() => { setError(""); setEditing({ ...EMPTY }); }}
        >
          <Plus size={13} /> New invoice
        </button>
      </header>

      <StatStrip stats={stats} className="shrink-0" />

      <FilterBar
        className="shrink-0"
        filters={filters}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Client or item…"
        onClear={clearFilters}
      />

      {!loaded ? (
        <p className="py-12 text-center text-[13px] text-text-muted">Loading…</p>
      ) : (
        <MasterDetail
          hasSelection={!!selected}
          onBack={() => setSelectedId(null)}
          backLabel="All invoices"
          listWidth="440px"
          list={listPane}
          detail={
            <InvoiceDetail
              payment={selected}
              brands={brands}
              onChanged={load}
              onEdit={(p) => {
                setError("");
                setEditing({
                  id: p.id, client: p.client ?? "", item: p.item ?? "",
                  amount: p.amount == null ? "" : String(p.amount),
                  due: p.due ?? "", status: p.status,
                });
              }}
            />
          }
        />
      )}

      {editing && (
        <Modal title={editing.id ? "Edit invoice" : "New invoice"} onClose={() => setEditing(null)}>
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
