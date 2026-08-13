"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Clock, FileText, FolderKanban, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { money, moneyShort } from "@/lib/format";
import { SEVERE_DAYS, daysPastDue } from "@/lib/money";
import { UNPAID } from "@/lib/rollup";
import type { Payment, Project, Proposal } from "@/types/ops";

const DAY = 86_400_000;

type Window = 7 | 14 | 28;

function dateOf(iso: string | null | undefined) {
  if (!iso) return null;
  const t = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function Cell({
  icon: Icon, label, value, sub, color,
}: {
  icon: LucideIcon; label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="min-w-0 rounded-card border border-[var(--border)] bg-surface p-3">
      <div className="flex items-center gap-1.5">
        <Icon size={12} style={{ color }} strokeWidth={2.2} />
        <span className="truncate text-[10.5px] font-medium uppercase tracking-wider text-text-muted">{label}</span>
      </div>
      <p className="mt-1.5 text-[19px] font-bold leading-none tabular-nums text-text">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-text-muted">{sub}</p>
    </div>
  );
}

/**
 * The last 7, 14 or 28 days, counted from each record's own date.
 *
 * Money in is what a payment row confirms landed, so it is a fact rather than
 * an assumption about an invoice going out. Money out is not shown at all:
 * nothing in this database records spending, and an empty figure sitting beside
 * a real one reads as zero spend rather than as no data.
 */
export function PeriodSummary({
  payments, proposals, projects,
}: {
  payments: Payment[]; proposals: Proposal[]; projects: Project[];
}) {
  const [days, setDays] = useState<Window>(7);
  const s = useMemo(() => {
    const since = Date.now() - days * DAY;
    // Undated rows are excluded here rather than assumed recent. A window is a
    // claim about when something happened, and a missing date cannot support it.
    const inWindow = (iso: string | null | undefined) => {
      const t = dateOf(iso);
      return t != null && t >= since;
    };

    // Only rows carrying a real paid date count. Falling back to the issue date
    // would report money as collected on the day it was billed.
    const collectedRows = payments.filter((p) => p.status === "paid" && inWindow(p.paid_at));
    const collected = collectedRows.reduce((a, p) => a + (p.amount ?? 0), 0);
    const paidNoDate = payments.filter((p) => p.status === "paid" && !p.paid_at).length;

    const proposed = proposals.filter((p) => inWindow(p.sent ?? p.created_at));
    const proposedValue = proposed.reduce((a, p) => a + (p.amount ?? 0), 0);
    const started = projects.filter((p) => inWindow(p.start_date));

    const unpaid = payments.filter((p) => UNPAID.includes(p.status));
    // Overdue is the stated convention: 15 days past due, where an undated
    // invoice is treated as due 15 days after issue.
    const overdue = unpaid.filter((p) => daysPastDue(p) > SEVERE_DAYS);
    const pending = unpaid.filter((p) => daysPastDue(p) <= SEVERE_DAYS);

    return {
      collected, collectedRows, paidNoDate,
      proposed, proposedValue, started,
      overdue, overdueValue: overdue.reduce((a, p) => a + (p.amount ?? 0), 0),
      pending, pendingValue: pending.reduce((a, p) => a + (p.amount ?? 0), 0),
      unpriced: unpaid.filter((p) => p.amount == null).length,
    };
  }, [payments, proposals, projects, days]);

  return (
    <section className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-tight text-text">Last {days} days</h2>
        <div className="flex gap-1">
          {([7, 14, 28] as Window[]).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-pill border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                days === d
                  ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-text)]"
                  : "border-[var(--border)] text-text-muted hover:text-text"
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Cell
          icon={ArrowDownLeft} color="#00d4aa" label="Money in"
          value={moneyShort(s.collected)}
          sub={`${s.collectedRows.length} invoice${s.collectedRows.length === 1 ? "" : "s"} settled${
            s.paidNoDate > 0 ? ` · ${s.paidNoDate} paid with no date, not counted` : ""
          }`}
        />
        <Cell
          icon={FileText} color="#3b82f6" label="Proposed"
          value={String(s.proposed.length)}
          sub={s.proposedValue > 0 ? `${money(s.proposedValue)} of work` : "Nothing quoted"}
        />
        <Cell
          icon={FolderKanban} color="#8b5cf6" label="Started"
          value={String(s.started.length)}
          sub={s.started.length ? s.started.map((p) => p.client ?? p.name).slice(0, 2).join(", ") : "Nothing started"}
        />
        <Cell
          icon={TriangleAlert} color="#e5484d" label={`Overdue ${SEVERE_DAYS}d+`}
          value={moneyShort(s.overdueValue)}
          sub={`${s.overdue.length} invoice${s.overdue.length === 1 ? "" : "s"} past ${SEVERE_DAYS} days`}
        />
        <Cell
          icon={Clock} color="#f59e0b" label="Pending"
          value={moneyShort(s.pendingValue)}
          sub={`${s.pending.length} out, not yet ${SEVERE_DAYS} days${s.unpriced ? ` · ${s.unpriced} with no amount` : ""}`}
        />
      </div>

      {/* Named rather than omitted: a missing panel looks like nothing was
          spent, which is a different claim from having no record of spending. */}
      <p className="flex items-center gap-1.5 text-[10.5px] text-text-muted">
        <ArrowUpRight size={11} className="shrink-0" />
        Money out is not shown. Nothing in ARC records spending yet, and a zero here would read as none.
      </p>
    </section>
  );
}
