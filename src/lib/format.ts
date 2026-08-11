export function money(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function dueClass(due: string | null): "" | "overdue" | "soon" {
  if (!due) return "";
  const d = new Date(due + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 3);
  if (d < today) return "overdue";
  if (d <= soon) return "soon";
  return "";
}

export function daysAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  const diff = Math.round((Date.now() - d.getTime()) / 86_400_000);
  return `${diff}d ago`;
}

// Indian short money: ₹4.61L, ₹1.28Cr. Below a lakh stays fully written out.
export function moneyShort(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000) return `${sign}₹${(abs / 100_000).toFixed(2)}L`;
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
}

// Coarse relative time off a timestamp: 10m ago, 3h ago, 2d ago.
export function timeAgo(ts: string | null): string {
  if (!ts) return "—";
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return "—";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

// Compact relative time for the activity rail: 2m, 45m, 3h, 1d, 4w.
export function shortAgo(ts: string | null): string {
  if (!ts) return "—";
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return "—";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return `${Math.round(days / 30)}mo`;
}

// Initials for an avatar tile: "BCON Club" → "BC", "WindChasers" → "WC".
export function initials(name: string | null | undefined): string {
  if (!name) return "—";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Stable per-name colour so the same client always gets the same tile.
const AVATAR_COLORS = [
  "#e5484d", "#f59e0b", "#00d4aa", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];
export function avatarColor(name: string | null | undefined): string {
  if (!name) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// Which 0..days-1 bucket a timestamp falls in; today is the last slot.
// Compares midnight-to-midnight so any time later today still lands on today.
function bucketIndex(ts: string, days: number): number | null {
  const t = new Date(ts.length <= 10 ? ts + "T00:00:00" : ts).getTime();
  if (!Number.isFinite(t)) return null;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const tDay = new Date(t);
  tDay.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfToday.getTime() - tDay.getTime()) / 86_400_000);
  return days - 1 - dayDiff;
}

// Buckets timestamps into a 7-day count series for the stat-card sparklines.
export function dailySeries(timestamps: (string | null)[], days = 7): number[] {
  const out = new Array(days).fill(0);
  for (const ts of timestamps) {
    if (!ts) continue;
    const idx = bucketIndex(ts, days);
    if (idx != null && idx >= 0 && idx < days) out[idx] += 1;
  }
  return out;
}

// Running balance over the window. Anything dated before the window (or undated)
// seeds the baseline, so the line shows the true outstanding total rather than
// implying it climbed from zero in seven days.
export function dailyTotals(rows: { ts: string | null; amount: number | null }[], days = 7): number[] {
  const out = new Array(days).fill(0);
  let baseline = 0;
  for (const r of rows) {
    const amt = r.amount ?? 0;
    const idx = r.ts ? bucketIndex(r.ts, days) : null;
    if (idx == null) { baseline += amt; continue; }
    if (idx >= days) continue;          // future-dated — not on the chart yet
    if (idx < 0) { baseline += amt; continue; }
    out[idx] += amt;
  }
  let run = baseline;
  for (let i = 0; i < days; i++) { run += out[i]; out[i] = run; }
  return out;
}
