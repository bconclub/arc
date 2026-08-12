import { UNPAID } from "@/lib/rollup";
import type { Payment } from "@/types/ops";

/**
 * Receivables maths, in one place.
 *
 * This logic previously lived inside the dashboard page. The Invoices screen
 * needs exactly the same numbers, and two copies of a money calculation drift, * which is how overdue came to be counted twice in the first place.
 */

const DAY = 86_400_000;

/**
 * Payment terms assumed when an invoice carries no due date.
 *
 * Every payment row in this database has a null due date, so "overdue" was
 * coming only from a status somebody typed by hand. Treating an undated invoice
 * as due 15 days after it was issued turns that into something computed from a
 * stated convention. It is an assumption, so anywhere it is used must say so.
 */
export const DEFAULT_TERMS_DAYS = 15;

/** How far past due an invoice has to be before it stops being a nudge. */
export const SEVERE_DAYS = 15;

/** The due date to reason with: the printed one, or issue date plus terms. */
export function effectiveDue(p: Pick<Payment, "due" | "created_at">): { date: string; assumed: boolean } {
  if (p.due) return { date: p.due, assumed: false };
  const issued = new Date(p.created_at).getTime();
  const d = new Date((Number.isFinite(issued) ? issued : Date.now()) + DEFAULT_TERMS_DAYS * DAY);
  return { date: d.toISOString().slice(0, 10), assumed: true };
}

/** Days past due. Negative means not yet due. */
export function daysPastDue(p: Pick<Payment, "due" | "created_at">): number {
  const { date } = effectiveDue(p);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - new Date(date + "T00:00:00").getTime()) / DAY);
}

export type DueTone = "overdue" | "soon" | "normal";
export type DueInfo = { text: string; tone: DueTone; days: number | null };

/** `days` is negative when overdue, null when the invoice carries no due date. */
export function dueLabel(due: string | null): DueInfo {
  if (!due) return { text: "No due date", tone: "normal", days: null };
  const d = new Date(due + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / DAY);
  if (diff < 0) return { text: `${Math.abs(diff)} days overdue`, tone: "overdue", days: diff };
  if (diff === 0) return { text: "Due today", tone: "soon", days: 0 };
  return { text: `Due in ${diff}d`, tone: diff <= 3 ? "soon" : "normal", days: diff };
}

/** Mutually exclusive, every unpaid invoice lands in exactly one. */
export type Ageing = { overdue: number; soon: number; mid: number; far: number; undated: number };

/** How far past due, for the overdue slice only: ≤15d, ≤30d, ≤60d, 60d+. */
export type OverdueBuckets = { b1: number; b2: number; b3: number; b4: number };

export type Receivables = {
  unpaid: Payment[];
  overdueRows: Payment[];
  paidRows: Payment[];
  /** Sum of every unpaid invoice. Understated whenever `unpricedCount` > 0. */
  total: number;
  overdueTotal: number;
  /** Not yet overdue and due within 30 days. */
  dueWithinMonth: number;
  collected: number;
  ageing: Ageing;
  overdueBuckets: OverdueBuckets;
  /** Unpaid invoices with no amount recorded, see note below. */
  unpricedCount: number;
  /**
   * Mean days from issue to payment, or null when nothing supports it.
   * `measured` says how many rows the average is drawn from and `missing` how
   * many paid rows were excluded for carrying no paid date, so the figure is
   * never presented as covering more than it actually does.
   */
  daysToPay: { average: number | null; measured: number; missing: number };

  /**
   * Overdue judged on the effective due date, so undated invoices are included
   * rather than sitting in a bucket of their own forever.
   */
  overdueByTerms: { total: number; count: number };
  /** More than SEVERE_DAYS past due. The ones that need chasing, not nudging. */
  severelyOverdue: { total: number; count: number; rows: Payment[] };
  /** How many of the figures above rest on the assumed due date. */
  assumedDueCount: number;
};

export function receivables(payments: Payment[]): Receivables {
  const unpaid = payments.filter((p) => UNPAID.includes(p.status));
  const overdueRows = payments.filter((p) => p.status === "overdue");
  const paidRows = payments.filter((p) => p.status === "paid");

  const ageing: Ageing = { overdue: 0, soon: 0, mid: 0, far: 0, undated: 0 };
  const overdueBuckets: OverdueBuckets = { b1: 0, b2: 0, b3: 0, b4: 0 };

  // Invoices counted in the total with no amount recorded. Whenever this is
  // non-zero the headline is an undercount, so callers must surface it rather
  // than presenting the sum as complete.
  let unpricedCount = 0;

  for (const p of unpaid) {
    const amt = p.amount ?? 0;
    if (p.amount == null) unpricedCount += 1;
    const { days } = dueLabel(p.due);

    // Status wins over date: an invoice marked overdue is overdue whatever its
    // due date says. Buckets stay exclusive, an earlier version added overdue
    // rows to both the overdue total AND a due-date bucket, so the same money
    // appeared twice in the same legend.
    if (p.status === "overdue" || (days != null && days < 0)) {
      ageing.overdue += amt;
      if (days != null) {
        const od = Math.abs(days);
        if (od <= 15) overdueBuckets.b1 += amt;
        else if (od <= 30) overdueBuckets.b2 += amt;
        else if (od <= 60) overdueBuckets.b3 += amt;
        else overdueBuckets.b4 += amt;
      }
      continue;
    }
    // Undated invoices get their own bucket rather than being lumped into
    // "31 days+", which made every undated row look like a distant problem.
    if (days == null) { ageing.undated += amt; continue; }
    if (days <= 7) ageing.soon += amt;
    else if (days <= 30) ageing.mid += amt;
    else ageing.far += amt;
  }

  // Days from raising the invoice to the money landing. Only rows that carry a
  // real paid_at count. Falling back to created_at or due for the rest would
  // manufacture the exact number this measures, so those rows are excluded and
  // reported separately instead.
  const spans: number[] = [];
  let missingPaidAt = 0;
  for (const p of paidRows) {
    if (!p.paid_at) { missingPaidAt += 1; continue; }
    const paid = new Date(p.paid_at + "T00:00:00").getTime();
    const issued = new Date(p.created_at).getTime();
    if (!Number.isFinite(paid) || !Number.isFinite(issued)) { missingPaidAt += 1; continue; }
    const days = Math.round((paid - issued) / DAY);
    // A negative span means the dates contradict each other; counting it would
    // drag the average below zero rather than surfacing the bad row.
    if (days < 0) { missingPaidAt += 1; continue; }
    spans.push(days);
  }

  // Overdue recomputed against the effective due date. The status column still
  // wins when it says overdue, since somebody asserting it outranks a guess.
  const overdueTerms = unpaid.filter((p) => p.status === "overdue" || daysPastDue(p) > 0);
  const severeRows = unpaid.filter((p) => daysPastDue(p) > SEVERE_DAYS);

  return {
    unpaid, overdueRows, paidRows,
    overdueByTerms: {
      total: overdueTerms.reduce((s, p) => s + (p.amount ?? 0), 0),
      count: overdueTerms.length,
    },
    severelyOverdue: {
      total: severeRows.reduce((s, p) => s + (p.amount ?? 0), 0),
      count: severeRows.length,
      rows: severeRows,
    },
    assumedDueCount: unpaid.filter((p) => !p.due).length,
    daysToPay: {
      average: spans.length ? Math.round(spans.reduce((s, x) => s + x, 0) / spans.length) : null,
      measured: spans.length,
      missing: missingPaidAt,
    },
    total: unpaid.reduce((s, p) => s + (p.amount ?? 0), 0),
    overdueTotal: ageing.overdue,
    dueWithinMonth: ageing.soon + ageing.mid,
    collected: paidRows.reduce((s, p) => s + (p.amount ?? 0), 0),
    ageing, overdueBuckets, unpricedCount,
  };
}
