/**
 * Revenue analytics off the GST invoice history.
 *
 * The Indian financial year runs April to March, so FY2024-25 starts 2024-04-01.
 * Grouping by calendar year would split every year's trading across two buckets
 * and make each one look half the size.
 */

export type GstInvoice = {
  id: string;
  invoice_no: string | null;
  issued_on: string | null;
  client: string;
  brand_id: string | null;
  billed_amount: number | null;
  total_amount: number | null;
  gst_amount: number | null;
  gstin: string | null;
  gst_status: string;
  notes: string | null;
};

/** FY starting year: 2024 means FY2024-25. */
export function fyOf(isoDate: string): number {
  const y = Number(isoDate.slice(0, 4));
  const m = Number(isoDate.slice(5, 7));
  return m >= 4 ? y : y - 1;
}

export const fyLabel = (start: number) => `FY${start}-${String((start + 1) % 100).padStart(2, "0")}`;

export type Bucket = { key: string; label: string; billed: number; gst: number; count: number };

function bucket(rows: GstInvoice[], keyOf: (r: GstInvoice) => string | null, labelOf: (k: string) => string): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const r of rows) {
    const k = keyOf(r);
    if (k == null) continue;
    const b = map.get(k) ?? { key: k, label: labelOf(k), billed: 0, gst: 0, count: 0 };
    b.billed += r.billed_amount ?? 0;
    b.gst += r.gst_amount ?? 0;
    b.count += 1;
    map.set(k, b);
  }
  // Array.from, not spread: the TS target predates ES2015 iterators.
  return Array.from(map.values());
}

export type RevenueAnalysis = {
  /** Invoices excluded from every total, and why. */
  excluded: { cancelled: number; undated: number; unpriced: number };
  counted: number;
  totalBilled: number;
  totalGst: number;
  byFy: Bucket[];
  byClient: Bucket[];
  /** Financial years present, newest first. */
  years: number[];
};

/**
 * `fy` filters everything except the FY series itself, which always shows all
 * years so the filter has context to sit in.
 */
export function analyseRevenue(all: GstInvoice[], fy: number | null): RevenueAnalysis {
  // A cancelled invoice was never revenue. Counting it would overstate every
  // total it touches, so it is excluded and the exclusion is reported.
  const cancelled = all.filter((r) => r.gst_status === "cancelled");
  const live = all.filter((r) => r.gst_status !== "cancelled");

  const undated = live.filter((r) => !r.issued_on);
  const dated = live.filter((r): r is GstInvoice & { issued_on: string } => !!r.issued_on);

  const scoped = fy == null ? dated : dated.filter((r) => fyOf(r.issued_on) === fy);

  const byFy = bucket(dated, (r) => String(fyOf(r.issued_on!)), (k) => fyLabel(Number(k)))
    .sort((a, b) => Number(b.key) - Number(a.key));

  const byClient = bucket(scoped, (r) => r.client.trim(), (k) => k)
    .sort((a, b) => b.billed - a.billed);

  return {
    excluded: {
      cancelled: cancelled.length,
      undated: undated.length,
      // Rows counted in the totals with no billed figure recorded, which makes
      // those totals an undercount by an unknown amount.
      unpriced: scoped.filter((r) => r.billed_amount == null).length,
    },
    counted: scoped.length,
    totalBilled: scoped.reduce((s, r) => s + (r.billed_amount ?? 0), 0),
    totalGst: scoped.reduce((s, r) => s + (r.gst_amount ?? 0), 0),
    byFy,
    byClient,
    years: byFy.map((b) => Number(b.key)),
  };
}
