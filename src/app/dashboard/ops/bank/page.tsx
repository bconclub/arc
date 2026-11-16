"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Landmark, Link2, Smartphone } from "lucide-react";
import { SegmentedTabs, type Tab } from "@/components/ui/SegmentedTabs";
import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { inputCls } from "@/components/ops/Modal";
import { money } from "@/lib/format";

type Txn = {
  id: string;
  bank: string | null;
  account: string | null;
  direction: "credit" | "debit";
  amount: number;
  txn_at: string;
  channel: string | null;
  counterparty: string | null;
  ref: string | null;
  body: string | null;
  status: "new" | "matched" | "business" | "personal" | "ignored";
  label: string | null;
  payment_id: string | null;
};
type Open = { id: string; client: string | null; item: string | null; amount: number | null; status: string; due: string | null; invoice_no: string | null };

type TabKey = "all" | "credit" | "debit" | "new";

const DAY = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const TIME = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const MONTH = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });

function shiftMonth(m: string, by: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

const STATUS_TEXT: Record<Txn["status"], string> = {
  new: "To check",
  matched: "Matched",
  business: "Business",
  personal: "Personal",
  ignored: "Ignored",
};

export default function BankPage() {
  const [month, setMonth] = useState(() => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 7));
  const [txns, setTxns] = useState<Txn[]>([]);
  const [open, setOpen] = useState<Open[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<TabKey>("all");
  const [account, setAccount] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/ops/bank?month=${month}`).then((x) => x.json()).catch(() => null);
    setTxns(Array.isArray(r?.txns) ? r.txns : []);
    setOpen(Array.isArray(r?.open) ? r.open : []);
    setLoaded(true);
  }, [month]);
  useEffect(() => { load(); }, [load]);

  const accounts = useMemo(
    () => Array.from(new Set(txns.map((t) => `${t.bank ?? "Bank"} ·${t.account ?? "?"}`))).sort(),
    [txns],
  );

  const scoped = useMemo(
    () => txns.filter((t) => !account || `${t.bank ?? "Bank"} ·${t.account ?? "?"}` === account),
    [txns, account],
  );

  const visible = useMemo(() => scoped.filter((t) => {
    if (tab === "credit" || tab === "debit") return t.direction === tab;
    if (tab === "new") return t.status === "new";
    return true;
  }), [scoped, tab]);

  const sum = (f: (t: Txn) => boolean) => scoped.filter(f).reduce((a, t) => a + Number(t.amount), 0);
  const inAll = sum((t) => t.direction === "credit" && t.status !== "ignored");
  const inBiz = sum((t) => t.direction === "credit" && (t.status === "matched" || t.status === "business"));
  const outAll = sum((t) => t.direction === "debit" && t.status !== "ignored");
  const toCheck = scoped.filter((t) => t.status === "new").length;

  const stats: Stat[] = [
    { key: "in", label: "Money in", value: money(inAll), hint: `${money(inBiz)} tagged business`, icon: ArrowDownLeft, valueClass: "text-accent-green" },
    { key: "out", label: "Money out", value: money(outAll), hint: "spends and transfers", icon: ArrowUpRight },
    { key: "net", label: "Net", value: money(inAll - outAll), hint: MONTH.format(new Date(month + "-01")), icon: Landmark },
    { key: "check", label: "To check", value: String(toCheck), hint: "not tagged yet", icon: Link2, valueClass: toCheck ? "text-accent-orange" : undefined },
  ];

  const tabs: Tab<TabKey>[] = [
    { value: "all", label: "All", count: scoped.length },
    { value: "credit", label: "In", count: scoped.filter((t) => t.direction === "credit").length },
    { value: "debit", label: "Out", count: scoped.filter((t) => t.direction === "debit").length },
    { value: "new", label: "To check", count: toCheck },
  ];

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    const r = await fetch(`/api/ops/bank/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (!r.ok) { alert((await r.json().catch(() => ({})))?.error || "Save failed"); return; }
    load();
  }

  // Group by IST day.
  const groups = useMemo(() => {
    const g: { day: string; rows: Txn[] }[] = [];
    for (const t of visible) {
      const day = DAY.format(new Date(t.txn_at));
      if (!g.length || g[g.length - 1].day !== day) g.push({ day, rows: [] });
      g[g.length - 1].rows.push(t);
    }
    return g;
  }, [visible]);

  return (
    <div className="flex flex-col gap-3 px-4 pb-6 pt-4 sm:px-5 lg:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Landmark size={19} className="text-text-muted" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text">Bank</h1>
            <p className="mt-0.5 text-[12.5px] text-text-muted">Every credit and spend read from bank SMS on the phone</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[12.5px] text-text hover:bg-[var(--surface-hover)]" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
          <span className="min-w-[120px] text-center text-[13px] font-medium text-text">{MONTH.format(new Date(month + "-01"))}</span>
          <button className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[12.5px] text-text hover:bg-[var(--surface-hover)]" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
        </div>
      </header>

      <StatStrip stats={stats} />

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} size="sm" ariaLabel="Filter" />
        {accounts.length > 1 && (
          <select className={`${inputCls} w-auto py-1.5 text-[12.5px]`} value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="">All accounts</option>
            {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </div>

      <div className="overflow-hidden rounded-panel border border-[var(--border)] bg-surface shadow-card">
        {!loaded ? (
          <p className="px-4 py-10 text-center text-[12.5px] text-text-muted">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-[12.5px] text-text-muted">
            <Smartphone size={20} />
            {txns.length === 0 ? "Nothing yet for this month. Open the ARC Bank app on the phone and tap Send." : "Nothing matches this filter."}
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.day}>
              <div className="border-b border-[var(--border)] bg-[var(--surface-hover)] px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">{g.day}</div>
              {g.rows.map((t) => {
                const credit = t.direction === "credit";
                const isOpen = expanded === t.id;
                const matchedTo = open.find((o) => o.id === t.payment_id);
                const suggestions = credit && !t.payment_id
                  ? [...open].sort((a, b) => Number(Math.abs((a.amount ?? 0) - t.amount) > 1) - Number(Math.abs((b.amount ?? 0) - t.amount) > 1))
                  : [];
                return (
                  <div key={t.id} className="border-b border-[var(--border)] last:border-b-0">
                    <button onClick={() => setExpanded(isOpen ? null : t.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--surface-hover)]">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${credit ? "bg-[var(--brand-faint)] text-accent-green" : "bg-[var(--surface-hover)] text-text-muted"}`}>
                        {credit ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-text">{t.label || t.counterparty || (credit ? "Credit" : "Debit")}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-text-muted">
                          {TIME.format(new Date(t.txn_at))} · {t.bank ?? "Bank"} ·{t.account ?? "?"}{t.channel ? ` · ${t.channel}` : ""}
                          {t.label && t.counterparty ? ` · ${t.counterparty}` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        <span className={`text-[13px] font-semibold tabular-nums ${credit ? "text-accent-green" : "text-text"}`}>{credit ? "+" : "−"}{money(t.amount)}</span>
                        <span className={`text-[10.5px] ${t.status === "new" ? "text-accent-orange" : "text-text-muted"}`}>{STATUS_TEXT[t.status]}</span>
                      </span>
                    </button>

                    {isOpen && (
                      <div className="flex flex-col gap-2.5 bg-[var(--surface-hover)] px-3 pb-3 pt-1 text-[12px]">
                        {t.body && <p className="rounded-md border border-[var(--border)] bg-surface px-2.5 py-2 font-mono text-[11px] leading-relaxed text-text-muted">{t.body}</p>}
                        {t.ref && <p className="text-text-muted">Ref <span className="font-mono text-text">{t.ref}</span></p>}

                        <div className="flex flex-wrap gap-1.5">
                          {(["business", "personal", "ignored"] as const).map((s) => (
                            <button key={s} disabled={busy === t.id}
                              onClick={() => patch(t.id, { status: t.status === s ? "new" : s })}
                              className={`rounded-md border px-2.5 py-1 ${t.status === s ? "border-transparent bg-[var(--brand-faint)] font-medium text-text" : "border-[var(--border)] text-text-muted hover:text-text"}`}>
                              {STATUS_TEXT[s]}
                            </button>
                          ))}
                        </div>

                        <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get("label"); patch(t.id, { label: String(v || "") || null }); }}>
                          <input name="label" defaultValue={t.label ?? ""} placeholder="Who is this? (e.g. Laptop Store, office rent)" className={`${inputCls} py-1.5 text-[12px]`} />
                          <button className="rounded-md border border-[var(--border)] px-2.5 text-text hover:bg-surface" disabled={busy === t.id}>Save</button>
                        </form>

                        {credit && (t.payment_id ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-text-muted">Settles <span className="text-text">{matchedTo ? `${matchedTo.client} · ${matchedTo.item}` : "an invoice"}</span></span>
                            <button className="text-accent-red" onClick={() => patch(t.id, { payment_id: null })}>Unmatch</button>
                          </div>
                        ) : suggestions.length > 0 && (
                          <select className={`${inputCls} py-1.5 text-[12px]`} defaultValue="" disabled={busy === t.id}
                            onChange={(e) => e.target.value && patch(t.id, { payment_id: e.target.value })}>
                            <option value="">Match to an open invoice…</option>
                            {suggestions.map((o) => (
                              <option key={o.id} value={o.id}>
                                {Math.abs((o.amount ?? 0) - t.amount) <= 1 ? "★ " : ""}{o.client} · {o.item} · {money(o.amount)}{o.invoice_no ? ` · ${o.invoice_no}` : ""}
                              </option>
                            ))}
                          </select>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
