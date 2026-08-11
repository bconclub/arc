import { dailyTotals } from "@/lib/format";
import type {
  Brand, BrandRollup, Payment, Person, Project, Proposal, OpsSignal,
} from "@/types/ops";

export const UNPAID: Payment["status"][] = ["pending", "invoiced", "overdue"];
export const IN_PLAY: Proposal["status"][] = ["sent", "discussing"];

/**
 * Every spelling a brand answers to: its name plus any `aliases`. The client
 * register keeps aliases like "Laptop Store" / "Laptopstore" / "itel computer"
 * for one brand, and payments were entered with whichever the invoice used — so
 * matching on name alone silently drops money from the rollup.
 */
export function brandKeys(brand: Pick<Brand, "name" | "aliases">): string[] {
  const keys = [brand.name, ...(brand.aliases ?? [])];
  return keys.filter(Boolean).map((k) => k.trim().toLowerCase()).filter((k) => k.length > 0);
}

/** Case-insensitive match of a row's free-text `client` against any brand key. */
function isClient(client: string | null, keys: string[]): boolean {
  if (!client) return false;
  return keys.includes(client.trim().toLowerCase());
}

/**
 * Contacts for a brand.
 *
 * `people.brand_id` is the real link and is preferred — it is set on most rows
 * and catches cases plain text cannot, e.g. an org recorded as
 * "Laptop Store India / proago.in". Rows without the FK fall back to matching
 * `org` against the brand's name/aliases, with compound orgs split on "/" and
 * "," so one side still matches.
 */
export function contactsFor(brand: Pick<Brand, "id" | "name" | "aliases">, people: Person[]): Person[] {
  const keys = brandKeys(brand);

  // Union, not either/or. A person can only carry ONE brand_id, but an org like
  // "WindChasers / Turquoise" legitimately spans two brands — matching on the FK
  // alone would show that contact under whichever side won the backfill and hide
  // them from the other.
  return people.filter((p) => {
    if (p.brand_id && p.brand_id === brand.id) return true;
    if (!p.org) return false;
    return p.org
      .split(/[/,]/)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
      .some((part) => keys.includes(part));
  });
}

/** Splits the free-text `channel` into things we can turn into links. */
export function parseChannel(channel: string | null): { emails: string[]; phones: string[]; other: string[] } {
  const out = { emails: [] as string[], phones: [] as string[], other: [] as string[] };
  if (!channel) return out;
  for (const raw of channel.split(/[/,;]/)) {
    const part = raw.trim();
    if (!part) continue;
    if (part.includes("@") && /\S+@\S+\.\S+/.test(part)) out.emails.push(part);
    else if (/^[+\d][\d\s-]{6,}$/.test(part)) out.phones.push(part.replace(/\s+/g, ""));
    else out.other.push(part);
  }
  return out;
}

/**
 * Health score, 0–100. A weighted average of whatever signal actually exists for
 * the brand — dimensions with no data are dropped and the remaining weights
 * renormalise, so a brand with only payments isn't punished for having no tasks.
 *
 *   40  payments on time      (share of invoices not overdue)
 *   25  task completion       (share of project tasks done)
 *   25  project progress      (mean progress across its projects)
 *   10  incident-free         (critical signals naming the brand, capped at 3)
 */
function healthScore(input: {
  totalPayments: number; overdueCount: number;
  totalTasks: number; doneTasks: number;
  projectCount: number; avgProgress: number;
  criticalSignals: number;
}): number {
  const parts: { w: number; v: number }[] = [];
  if (input.totalPayments > 0) parts.push({ w: 40, v: 1 - input.overdueCount / input.totalPayments });
  if (input.totalTasks > 0) parts.push({ w: 25, v: input.doneTasks / input.totalTasks });
  if (input.projectCount > 0) parts.push({ w: 25, v: input.avgProgress / 100 });
  parts.push({ w: 10, v: Math.max(0, 1 - input.criticalSignals / 3) });

  const wSum = parts.reduce((s, p) => s + p.w, 0);
  if (wSum === 0) return 0;
  const raw = parts.reduce((s, p) => s + p.w * Math.max(0, Math.min(1, p.v)), 0) / wSum;
  return Math.round(raw * 100);
}

/** Joins a brand to every project / payment / proposal carrying its name as `client`. */
export function rollupBrand(
  brand: Brand,
  projects: Project[],
  payments: Payment[],
  proposals: Proposal[],
  signals: OpsSignal[],
): BrandRollup {
  const keys = brandKeys(brand);
  const myPayments = payments.filter((p) => isClient(p.client, keys));
  const myProjects = projects.filter((p) => isClient(p.client, keys));
  const myProposals = proposals.filter((p) => isClient(p.client, keys));

  const unpaid = myPayments.filter((p) => UNPAID.includes(p.status));
  const overdueRows = myPayments.filter((p) => p.status === "overdue");

  const owed = unpaid.reduce((s, p) => s + (p.amount ?? 0), 0);
  const collected = myPayments.filter((p) => p.status === "paid").reduce((s, p) => s + (p.amount ?? 0), 0);
  const overdue = overdueRows.reduce((s, p) => s + (p.amount ?? 0), 0);
  const pipeline = myProposals.filter((p) => IN_PLAY.includes(p.status)).reduce((s, p) => s + (p.amount ?? 0), 0);

  // Anything not finished is still an engagement. 'waiting' and 'parked' mean
  // blocked or on hold, not closed — counting only 'active' made live accounts
  // (a security incident response, a paused Shopify build) read as dormant.
  const openProjects = myProjects.filter((p) => p.status !== "done").length;

  // Count, not sum. Several invoices are issued with no amount recorded, so a
  // brand with money genuinely outstanding was summing to zero and looking settled.
  const unpaidCount = unpaid.length;
  const unpricedCount = unpaid.filter((p) => p.amount == null).length;

  const allTasks = myProjects.flatMap((p) => p.tasks ?? []);
  const doneTasks = allTasks.filter((t) => t.done).length;
  const openTasks = allTasks.length - doneTasks;
  const avgProgress = myProjects.length
    ? myProjects.reduce((s, p) => s + (p.progress ?? 0), 0) / myProjects.length
    : 0;

  const criticalSignals = signals.filter((s) => {
    if (s.severity !== "critical") return false;
    const hay = `${s.title} ${s.detail ?? ""}`.toLowerCase();
    return keys.some((k) => hay.includes(k));
  }).length;

  const health = healthScore({
    totalPayments: myPayments.length,
    overdueCount: overdueRows.length,
    totalTasks: allTasks.length,
    doneTasks,
    projectCount: myProjects.length,
    avgProgress,
    criticalSignals,
  });

  return {
    ...brand,
    owed, collected, overdue, pipeline,
    openTasks, totalTasks: allTasks.length,
    activeProjects: myProjects.filter((p) => p.status === "active").length,
    openProjects, unpaidCount, unpricedCount,
    projectCount: myProjects.length,
    avgProgress: Math.round(avgProgress),
    criticalSignals,
    health,
    moneySeries: dailyTotals(unpaid.map((p) => ({ ts: p.created_at, amount: p.amount }))),
  };
}

export function rollupAll(
  brands: Brand[],
  projects: Project[],
  payments: Payment[],
  proposals: Proposal[],
  signals: OpsSignal[],
): BrandRollup[] {
  return brands
    .map((b) => rollupBrand(b, projects, payments, proposals, signals))
    .sort((a, b) => b.owed - a.owed || a.name.localeCompare(b.name));
}
