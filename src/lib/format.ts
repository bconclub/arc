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
