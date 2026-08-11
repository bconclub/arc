"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, IndianRupee, Receipt, Users } from "lucide-react";
import { money, moneyShort } from "@/lib/format";
import { analyseRevenue, fyLabel, type GstInvoice } from "@/lib/analytics";
import { brandIndex } from "@/lib/rollup";
import { SegmentedTabs, type Tab } from "@/components/ui/SegmentedTabs";
import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { StatusPill } from "@/components/ui/StatusPill";
import { BrandMark } from "@/components/ops/BrandMark";
import { WebAnalyticsPanel } from "@/components/ops/WebAnalyticsPanel";
import type { Brand } from "@/types/ops";

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-panel border border-[var(--border)] bg-surface shadow-card">
      <div className="shrink-0 px-4 pb-2 pt-3.5">
        <h2 className="text-[13.5px] font-semibold tracking-tight text-text">{title}</h2>
        {sub && <p className="mt-0.5 text-[11px] text-text-muted">{sub}</p>}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

/** Horizontal bar sized against the largest value in its own series. */
function Bar({ value, max, color = "var(--brand)" }: { value: number; max: number; color?: string }) {
  return (
    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-[var(--surface-hover)]">
      <div className="h-full rounded-pill" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color }} />
    </div>
  );
}

export default function AnalyticsPage() {
  const [rows, setRows] = useState<GstInvoice[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [fy, setFy] = useState<number | null>(null);

  const load = useCallback(async () => {
    const j = (u: string) => fetch(u).then((r) => r.json()).catch(() => []);
    const [inv, br] = await Promise.all([j("/api/ops/gst-invoices"), j("/api/ops/brands")]);
    setRows(Array.isArray(inv) ? inv : []);
    setBrands(Array.isArray(br) ? br : []);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const a = useMemo(() => analyseRevenue(rows, fy), [rows, fy]);
  const brandOf = useMemo(() => brandIndex(brands), [brands]);

  const tabs: Tab<string>[] = [
    { value: "all", label: "All time", count: rows.length },
    ...a.years.map((y) => ({
      value: String(y),
      label: fyLabel(y),
      count: a.byFy.find((b) => b.key === String(y))?.count,
    })),
  ];

  const stats: Stat[] = [
    {
      key: "billed", label: fy == null ? "Billed, all time" : `Billed, ${fyLabel(fy)}`,
      value: money(a.totalBilled), icon: IndianRupee,
      // The total understates by however much the unpriced rows were worth, so
      // that is stated rather than left for the reader to discover.
      hint: a.excluded.unpriced > 0
        ? `${a.counted} invoices, ${a.excluded.unpriced} with no amount`
        : `${a.counted} invoice${a.counted === 1 ? "" : "s"}`,
      valueClass: a.excluded.unpriced > 0 ? "text-accent-orange" : "text-text",
    },
    { key: "gst", label: "GST charged", value: money(a.totalGst), icon: Receipt, hint: "On the same invoices" },
    {
      key: "clients", label: "Clients billed", value: String(a.byClient.length), icon: Users,
      hint: a.byClient[0] ? `Largest: ${a.byClient[0].label}` : "None yet",
    },
    {
      key: "avg", label: "Average invoice",
      value: a.counted ? money(Math.round(a.totalBilled / a.counted)) : "-",
      icon: BarChart3, hint: fy == null ? "Across all years" : fyLabel(fy),
    },
  ];

  const maxFy = Math.max(...a.byFy.map((b) => b.billed), 1);
  const maxClient = Math.max(...a.byClient.map((b) => b.billed), 1);

  return (
    <div className="page space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <BarChart3 size={19} className="text-text-muted" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text">Revenue</h1>
            <p className="mt-0.5 text-[12.5px] text-text-muted">
              Billed history from GST invoices, by financial year and client
            </p>
          </div>
        </div>
        <SegmentedTabs
          tabs={tabs}
          value={fy == null ? "all" : String(fy)}
          onChange={(v) => setFy(v === "all" ? null : Number(v))}
          size="sm"
          ariaLabel="Financial year"
        />
      </header>

      {!loaded ? (
        <p className="py-12 text-center text-[13px] text-text-muted">Loading.</p>
      ) : rows.length === 0 ? (
        <div className="rounded-panel border border-dashed border-[var(--border)] px-6 py-14 text-center">
          <p className="text-[13px] text-text-muted">
            No invoice history yet. Run <code className="font-mono">scripts/import-gst.mjs</code> to load it.
          </p>
        </div>
      ) : (
        <>
          <StatStrip stats={stats} />

          {/* Anything left out of the figures above is named here rather than
              quietly dropped, so the totals can be trusted for what they are. */}
          {(a.excluded.cancelled > 0 || a.excluded.undated > 0) && (
            <p className="rounded-soft bg-[var(--surface-hover)] px-3 py-2 text-[11.5px] text-text-muted">
              Excluded:
              {a.excluded.cancelled > 0 && ` ${a.excluded.cancelled} cancelled invoice${a.excluded.cancelled === 1 ? "" : "s"}`}
              {a.excluded.cancelled > 0 && a.excluded.undated > 0 && " and"}
              {a.excluded.undated > 0 && ` ${a.excluded.undated} with no date, which cannot be placed in a financial year`}
              .
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Panel title="By financial year" sub="April to March, all years">
              <ul className="space-y-2.5 px-4 pb-4">
                {a.byFy.map((b) => (
                  <li key={b.key}>
                    <button
                      onClick={() => setFy(fy === Number(b.key) ? null : Number(b.key))}
                      className="flex w-full items-center gap-2 text-left"
                    >
                      <span className={`w-20 shrink-0 text-[12px] ${fy === Number(b.key) ? "font-semibold text-[var(--brand-text)]" : "text-text"}`}>
                        {b.label}
                      </span>
                      <Bar value={b.billed} max={maxFy} />
                      <span className="w-20 shrink-0 text-right text-[12px] tabular-nums text-text">
                        {moneyShort(b.billed)}
                      </span>
                    </button>
                    <span className="ml-[88px] block text-[10px] text-text-muted">
                      {b.count} invoice{b.count === 1 ? "" : "s"} · {moneyShort(b.gst)} GST
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="By client" sub={fy == null ? "All time, largest first" : `${fyLabel(fy)}, largest first`}>
              {a.byClient.length === 0 ? (
                <p className="px-4 py-8 text-center text-[12px] text-text-muted">Nothing billed in this year.</p>
              ) : (
                <ul className="space-y-2.5 px-4 pb-4">
                  {a.byClient.map((b) => {
                    const brand = brandOf(b.label);
                    return (
                      <li key={b.key} className="flex items-center gap-2">
                        <BrandMark
                          name={b.label}
                          logoUrl={brand?.logo_url}
                          color={brand?.color}
                          size={24}
                          radius="rounded-md"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-[12px] text-text">{b.label}</span>
                            <span className="shrink-0 text-[12px] tabular-nums text-text">{moneyShort(b.billed)}</span>
                          </span>
                          <span className="mt-1 flex items-center gap-2">
                            <Bar value={b.billed} max={maxClient} />
                            <span className="w-16 shrink-0 text-right text-[10px] text-text-muted">
                              {Math.round((b.billed / (a.totalBilled || 1)) * 100)}%
                            </span>
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          <WebAnalyticsPanel />

          <Panel title="Invoices" sub={fy == null ? `${rows.length} in total` : fyLabel(fy)}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-text-muted">
                    {["date", "invoice", "client", "billed", "gst", "status"].map((h) => (
                      <th key={h} className="px-4 py-2 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .filter((r) => fy == null || (r.issued_on ? Number(r.issued_on.slice(5, 7)) >= 4
                      ? Number(r.issued_on.slice(0, 4)) === fy
                      : Number(r.issued_on.slice(0, 4)) - 1 === fy : false))
                    .map((r) => (
                      <tr key={r.id} className="border-t border-[var(--border)]">
                        <td className="whitespace-nowrap px-4 py-2 tabular-nums text-text-muted">{r.issued_on ?? "No date"}</td>
                        <td className="whitespace-nowrap px-4 py-2 font-mono text-[11px] text-text-muted">{r.invoice_no ?? "-"}</td>
                        <td className="px-4 py-2 text-text">{r.client}</td>
                        <td className="whitespace-nowrap px-4 py-2 tabular-nums text-text">
                          {r.billed_amount == null ? <span className="text-accent-orange">Not recorded</span> : money(r.billed_amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 tabular-nums text-text-muted">
                          {r.gst_amount == null ? "-" : money(r.gst_amount)}
                        </td>
                        <td className="px-4 py-2"><StatusPill status={r.gst_status} /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
