"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { deliverableOf, money, moneyShort } from "@/lib/format";
import {
  DEFAULT_TERMS_DAYS, SEVERE_DAYS, daysPastDue, effectiveDue, receivables,
} from "@/lib/money";
import { IN_PLAY, brandIndex } from "@/lib/rollup";
import { StatusPill, type Tone } from "@/components/ui/StatusPill";
import { BrandMark } from "@/components/ops/BrandMark";
import type { Brand, Payment, Proposal } from "@/types/ops";

/**
 * One figure drawn as a ring.
 *
 * The arc is that figure's share of the three combined, so the rings read
 * against each other instead of each being a full circle that means nothing.
 */
function Ring({
  value, total, label, count, countLabel, href, color, icon: Icon,
}: {
  value: number; total: number; label: string; count: number;
  countLabel: string; href: string; color: string; icon: LucideIcon;
}) {
  const size = 148, stroke = 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  // A non-zero value always shows a sliver, otherwise "a little" and "none"
  // look identical at small shares.
  const dash = value > 0 ? Math.max(circ * 0.04, circ * (total > 0 ? value / total : 0)) : 0;

  return (
    <div className="flex min-w-[170px] flex-1 flex-col items-center gap-2 px-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-hover)" strokeWidth={stroke} />
          {dash > 0 && (
            <circle
              cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
              strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <Icon size={19} style={{ color }} strokeWidth={1.8} />
          <span className="mt-1 text-[25px] font-bold leading-none tracking-tight tabular-nums text-text">
            {moneyShort(value)}
          </span>
          <span className="mt-1 whitespace-nowrap text-[11px] text-text-muted">{label}</span>
        </div>
      </div>
      <Link href={href} className="flex flex-col items-center gap-0.5 text-center">
        <span className="text-[12px] font-medium" style={{ color }}>{count} {countLabel}</span>
        <span className="flex items-center gap-1 text-[11px] text-text-muted transition-colors hover:text-text">
          View all <ArrowRight size={11} />
        </span>
      </Link>
    </div>
  );
}

type Row = {
  id: string; client: string; item: string; type: string;
  amount: number | null; date: string | null; dateAssumed: boolean;
  statusText: string; tone: Tone; href: string;
};

type TabKey = "proposed" | "overdue" | "severe";

export function MoneyPanel({
  payments, proposals, brands,
}: {
  payments: Payment[]; proposals: Proposal[]; brands: Brand[];
}) {
  const [tab, setTab] = useState<TabKey>("proposed");
  const r = useMemo(() => receivables(payments), [payments]);
  const brandOf = useMemo(() => brandIndex(brands), [brands]);

  const inPlay = useMemo(() => proposals.filter((p) => IN_PLAY.includes(p.status)), [proposals]);
  const proposed = inPlay.reduce((s, p) => s + (p.amount ?? 0), 0);

  const rows: Record<TabKey, Row[]> = useMemo(() => {
    const fromPayment = (p: Payment): Row => {
      const { date, assumed } = effectiveDue(p);
      const past = daysPastDue(p);
      return {
        id: p.id,
        client: p.client ?? "Unnamed",
        item: deliverableOf(p.item ?? "", p.client) || "No description",
        type: "Invoice",
        amount: p.amount,
        date,
        dateAssumed: assumed,
        statusText:
          past > SEVERE_DAYS ? `${past} days past due`
          : past > 0 ? `Overdue by ${past} day${past === 1 ? "" : "s"}`
          : past === 0 ? "Due today"
          : `Due in ${Math.abs(past)} days`,
        tone: past > SEVERE_DAYS ? "bad" : past > 0 ? "bad" : past <= 3 ? "warn" : "info",
        href: "/dashboard/ops/money",
      };
    };
    // Worst first in both money tabs: the oldest debt is the one to act on.
    const byLateness = (a: Payment, b: Payment) => daysPastDue(b) - daysPastDue(a);
    return {
      proposed: inPlay.map((p) => ({
        id: p.id,
        client: p.client ?? "Unnamed",
        item: deliverableOf(p.name, p.client),
        type: "Proposal",
        amount: p.amount,
        date: p.sent,
        dateAssumed: false,
        statusText: p.status,
        tone: p.status === "discussing" ? "warn" : "info",
        href: "/dashboard/ops/proposals",
      })),
      overdue: Array.from(r.unpaid).filter((p) => daysPastDue(p) > 0 || p.status === "overdue").sort(byLateness).map(fromPayment),
      severe: Array.from(r.severelyOverdue.rows).sort(byLateness).map(fromPayment),
    };
  }, [r, inPlay]);

  const combined = proposed + r.overdueByTerms.total + r.severelyOverdue.total;

  const tabs: { key: TabKey; label: string; color: string }[] = [
    { key: "proposed", label: "Proposed", color: "#f59e0b" },
    { key: "overdue", label: "Overdue", color: "#e5484d" },
    { key: "severe", label: `${SEVERE_DAYS}+ days late`, color: "#b4243f" },
  ];
  const visible = rows[tab];

  return (
    <section className="overflow-hidden rounded-panel border border-[var(--border)] bg-surface shadow-card">
      <div className="px-4 pt-4">
        <h2 className="text-[17px] font-semibold tracking-tight text-text">Money / Receivables</h2>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-text-muted">
          All amounts in INR
          {/* Both of these change what the figures mean, so neither is left to
              be discovered. */}
          {r.assumedDueCount > 0 && (
            <> · {r.assumedDueCount} invoice{r.assumedDueCount === 1 ? "" : "s"} carry no due date, counted as due{" "}
              {DEFAULT_TERMS_DAYS} days after issue</>
          )}
          {r.unpricedCount > 0 && (
            <span className="text-accent-orange">
              {" "}· {r.unpricedCount} with no amount recorded, so the totals are short
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-start justify-center gap-y-5 px-2 py-4 lg:flex-nowrap lg:divide-x lg:divide-[var(--border)]">
        <Ring
          value={proposed} total={combined} label="Proposed"
          count={inPlay.length} countLabel={`proposal${inPlay.length === 1 ? "" : "s"} out`}
          href="/dashboard/ops/proposals" color="#f59e0b" icon={FileText}
        />
        <Ring
          value={r.overdueByTerms.total} total={combined} label="Overdue"
          count={r.overdueByTerms.count} countLabel={`invoice${r.overdueByTerms.count === 1 ? "" : "s"} past due`}
          href="/dashboard/ops/money" color="#e5484d" icon={Clock}
        />
        <Ring
          value={r.severelyOverdue.total} total={combined} label={`${SEVERE_DAYS}+ days late`}
          count={r.severelyOverdue.count} countLabel={r.severelyOverdue.count === 1 ? "needs chasing" : "need chasing"}
          href="/dashboard/ops/money" color="#b4243f" icon={AlertTriangle}
        />
      </div>

      <div className="border-t border-[var(--border)] p-3">
        <div className="scrollbar-hide flex gap-2 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center gap-2 rounded-soft px-3 py-2 text-[12.5px] font-medium transition-colors ${
                tab === t.key ? "bg-[var(--surface-hover)]" : "text-text-muted hover:text-text"
              }`}
              style={tab === t.key ? { color: t.color } : undefined}
            >
              {t.label}
              <span
                className="rounded-pill px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                style={{ background: `${t.color}22`, color: t.color }}
              >
                {rows[t.key].length}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-2 overflow-x-auto">
          {visible.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-text-muted">
              {tab === "severe" ? `Nothing more than ${SEVERE_DAYS} days late.` : "Nothing here."}
            </p>
          ) : (
            <table className="w-full min-w-[560px] text-[12.5px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-text-muted">
                  {["Client / Work", "Type", "Amount", tab === "proposed" ? "Sent" : "Due", "Status"].map((h) => (
                    <th key={h} className="px-2 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const brand = brandOf(row.client);
                  return (
                    <tr key={row.id} className="border-t border-[var(--border)]">
                      <td className="px-2 py-2.5">
                        <Link href={row.href} className="flex items-center gap-2.5">
                          <BrandMark name={row.client} logoUrl={brand?.logo_url} color={brand?.color} size={30} radius="rounded-lg" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-text">{row.item}</span>
                            <span className="block truncate text-[11px] text-text-muted">{row.client}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-text-muted">{row.type}</td>
                      <td className={`whitespace-nowrap px-2 py-2.5 font-medium tabular-nums ${row.amount == null ? "text-accent-orange" : "text-text"}`}>
                        {row.amount == null ? "Not recorded" : money(row.amount)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-text-muted">
                        {row.date
                          ? new Date(row.date.slice(0, 10) + "T00:00:00").toLocaleDateString("en-GB", {
                              day: "numeric", month: "short", year: "numeric",
                            })
                          : "No date"}
                        {/* An assumed date must never pass for one off the invoice. */}
                        {row.dateAssumed && <span className="ml-1 text-[10px] text-text-muted opacity-70">assumed</span>}
                      </td>
                      <td className="px-2 py-2.5"><StatusPill status={row.statusText} tone={row.tone} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
