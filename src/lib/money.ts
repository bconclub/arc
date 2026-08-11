import { UNPAID } from "@/lib/rollup";
import type { Payment } from "@/types/ops";

/**
 * Receivables maths, in one place.
 *
 * This logic previously lived inside the dashboard page. The Invoices screen
 * needs exactly the same numbers, and two copies of a money calculation drift —
 * which is how overdue came to be counted twice in the first place.
 */

const DAY = 86_400_000;

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

/** Mutually exclusive — every unpaid invoice lands in exactly one. */
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
  /** Unpaid invoices with no amount recorded — see note below. */
  unpricedCount: number;
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
    // due date says. Buckets stay exclusive — an earlier version added overdue
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

  return {
    unpaid, overdueRows, paidRows,
    total: unpaid.reduce((s, p) => s + (p.amount ?? 0), 0),
    overdueTotal: ageing.overdue,
    dueWithinMonth: ageing.soon + ageing.mid,
    collected: paidRows.reduce((s, p) => s + (p.amount ?? 0), 0),
    ageing, overdueBuckets, unpricedCount,
  };
}
