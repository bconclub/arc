"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, ChevronDown } from "lucide-react";
import { money, moneyShort } from "@/lib/format";
import { BrandMark } from "@/components/ops/BrandMark";
import { brandIndex } from "@/lib/rollup";
import type { Brand } from "@/types/ops";

type Doc = {
  id: string;
  kind: string;
  doc_no: string | null;
  client_id: string | null;
  issued_on: string | null;
  client_name: string;
  brand_id: string | null;
  amount: number | null;
  gross_amount: number | null;
  advance_paid: number | null;
  gst_pct: number | null;
  billed_as: string | null;
  settlement: string;
};

type GstFilter = "all" | "gst" | "nogst";

/**
 * Every document ever issued, with the GST split you actually bill along.
 *
 * Separate from the invoice list above, which is the working set that drives
 * receivables. This is history: 40 documents back to 2021, and not one of them
 * is claimed as settled, because the source records what was billed and says
 * nothing about what was paid.
 */
export function BillingVault({ brands }: { brands: Brand[] }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [gst, setGst] = useState<GstFilter>("all");
  const [year, setYear] = useState("all");
  const [open, setOpen] = useState(false);

  const brandOf = useMemo(() => brandIndex(brands), [brands]);

  useEffect(() => {
    fetch("/api/ops/billing")
      .then((r) => r.json())
      .then((d) => { setDocs(Array.isArray(d) ? d : []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const years = useMemo(() => Array.from(new Set(
    docs.map((d) => (d.issued_on ?? "").slice(0, 4)).filter(Boolean),
  )).sort().reverse(), [docs]);

  const rows = useMemo(() => docs.filter((d) => {
    if (gst === "gst" && !d.gst_pct) return false;
    if (gst === "nogst" && d.gst_pct) return false;
    if (year !== "all" && (d.issued_on ?? "").slice(0, 4) !== year) return false;
    return true;
  }), [docs, gst, year]);

  const totals = useMemo(() => {
    const inv = rows.filter((d) => d.kind === "invoice");
    const n = (x: number | null) => Number(x ?? 0);
    return {
      count: rows.length,
      invoices: inv.length,
      // Work value, not amount due: the amount carries GST that was never work
      // and is net of advances already taken off.
      work: inv.reduce((s, d) => s + n(d.gross_amount), 0),
      due: inv.reduce((s, d) => s + n(d.amount), 0),
      gst: inv.reduce((s, d) => s + n(d.gross_amount) * n(d.gst_pct) / 100, 0),
    };
  }, [rows]);

  if (!loaded || docs.length === 0) return null;

  const filters: { key: GstFilter; label: string; n: number }[] = [
    { key: "all", label: "All", n: docs.length },
    { key: "gst", label: "With GST", n: docs.filter((d) => d.gst_pct).length },
    { key: "nogst", label: "No GST", n: docs.filter((d) => !d.gst_pct).length },
  ];

  return (
    <section className="overflow-hidden rounded-panel border border-[var(--border)] bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
      >
        <Archive size={15} className="shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-text">Billing history</span>
          <span className="block text-[11px] text-text-muted">
            {docs.length} documents since {years[years.length - 1] ?? "?"} · {moneyShort(totals.work)} of work
          </span>
        </span>
        <ChevronDown size={15} className={`shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-[var(--border)] p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setGst(f.key)}
                className={`rounded-pill border px-3 py-1 text-[11.5px] font-medium transition-colors ${
                  gst === f.key
                    ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-text)]"
                    : "border-[var(--border)] text-text-muted hover:text-text"
                }`}
              >
                {f.label} <span className="tabular-nums opacity-70">{f.n}</span>
              </button>
            ))}
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="ml-auto rounded-pill border border-[var(--border)] bg-surface px-2.5 py-1 text-[11.5px] text-text outline-none"
            >
              <option value="all">Every year</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { l: "Work value", v: moneyShort(totals.work), c: "var(--text)" },
              { l: "GST charged", v: moneyShort(totals.gst), c: "#8b5cf6" },
              { l: "Amount billed", v: moneyShort(totals.due), c: "var(--text)" },
            ].map((s) => (
              <div key={s.l} className="rounded-soft border border-[var(--border)] p-2.5">
                <p className="text-[15px] font-bold tabular-nums" style={{ color: s.c }}>{s.v}</p>
                <p className="mt-0.5 text-[10px] text-text-muted">{s.l}</p>
              </div>
            ))}
          </div>

          <p className="mt-2 text-[10.5px] text-text-muted">
            {/* Never let history read as money confirmed in the bank. */}
            Whether each was settled is not recorded, so none is shown as paid.
          </p>

          <div className="mt-2 max-h-[420px] overflow-auto">
            <table className="w-full min-w-[600px] text-[12px]">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-left text-[9.5px] uppercase tracking-wider text-text-muted">
                  {["Date", "Client", "Number", "Work", "GST", "Billed", "Billed as"].map((h) => (
                    <th key={h} className="py-1.5 pr-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const brand = brandOf(d.client_name);
                  return (
                    <tr key={d.id} className="border-t border-[var(--border)]">
                      <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-text-muted">{d.issued_on ?? "-"}</td>
                      <td className="py-2 pr-3">
                        <span className="flex items-center gap-2">
                          <BrandMark name={d.client_name} logoUrl={brand?.logo_url} color={brand?.color} size={20} radius="rounded" />
                          <span className="max-w-[190px] truncate text-text">{d.client_name}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-text-muted">
                        {d.doc_no ?? "-"}
                        {d.kind !== "invoice" && (
                          <span className="ml-1.5 text-[9px] font-bold uppercase text-accent-orange">{d.kind}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-text">{money(Number(d.gross_amount ?? 0))}</td>
                      <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-text-muted">{d.gst_pct ? `${d.gst_pct}%` : "-"}</td>
                      <td className="whitespace-nowrap py-2 pr-3 font-medium tabular-nums text-text">{money(Number(d.amount ?? 0))}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-[11px] text-text-muted">{d.billed_as ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
