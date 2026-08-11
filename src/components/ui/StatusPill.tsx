/**
 * The single place a status becomes a colour.
 *
 * Before this, "overdue" was styled inline on the Money table, again on the
 * brand card, and again on the dashboard — three definitions that had already
 * drifted. Anything status-shaped should render through here.
 */

export type Tone = "neutral" | "brand" | "good" | "warn" | "bad" | "info";

const TONE: Record<Tone, string> = {
  neutral: "bg-[var(--surface-hover)] text-text-muted",
  brand: "bg-[var(--brand-soft)] text-[var(--brand-text)]",
  good: "bg-[rgba(0,212,170,0.14)] text-accent-green",
  warn: "bg-[rgba(245,158,11,0.14)] text-accent-orange",
  bad: "bg-[rgba(255,68,68,0.14)] text-accent-red",
  info: "bg-[rgba(59,130,246,0.14)] text-accent-blue",
};

/** Payment statuses, plus the states the invoice screen adds on top. */
const STATUS_TONE: Record<string, Tone> = {
  paid: "good",
  pending: "neutral",
  invoiced: "info",
  overdue: "bad",
  draft: "neutral",
  unsent: "warn",
  viewed: "info",
  unpaid: "warn",
  active: "good",
  waiting: "warn",
  parked: "neutral",
  done: "good",
  won: "good",
  lost: "bad",
  sent: "info",
  discussing: "warn",
  // GST filing vocabulary from the invoice history.
  filed: "good",
  unfiled: "warn",
  cancelled: "bad",
  omitted: "neutral",
};

export function toneFor(status: string | null | undefined): Tone {
  if (!status) return "neutral";
  return STATUS_TONE[status.trim().toLowerCase()] ?? "neutral";
}

export function StatusPill({
  status, tone, count, className = "",
}: {
  status: string;
  /** Override the mapping — for labels that aren't a known status. */
  tone?: Tone;
  count?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 text-[10.5px] font-semibold capitalize leading-[1.5] ${
        TONE[tone ?? toneFor(status)]
      } ${className}`}
    >
      {status}
      {count != null && <span className="tabular-nums opacity-70">{count}</span>}
    </span>
  );
}
