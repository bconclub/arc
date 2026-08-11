import { dailyTotals } from "@/lib/format";
import type {
  Brand, BrandRollup, Payment, Project, Proposal, OpsSignal,
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
