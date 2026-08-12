"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, Plus, ChevronRight } from "lucide-react";
import { moneyShort } from "@/lib/format";
import { rollupAll } from "@/lib/rollup";
import { BrandMark } from "@/components/ops/BrandMark";
import {
  BRAND_KIND_LABEL,
  type Brand, type BrandKind, type BrandRollup,
  type Project, type Payment, type Proposal, type OpsSignal,
} from "@/types/ops";

// Rows without `kind` predate the classification migration; they were all
// entered as clients, so that is the safe default.
const kindOf = (b: Brand): BrandKind => (b.kind ?? "client") as BrandKind;

const KIND_COLOR: Record<BrandKind, string> = {
  client: "#00d4aa",
  agency: "#8b5cf6",
  partner: "#3b82f6",
  prospect: "#f59e0b",
  own: "#6b6b6b",
};

/**
 * Money past its due date. Its own group, ahead of everything else.
 *
 * Overdue was a red badge on a card sitting inside Live, so the one state that
 * needs acting on today was mixed in with work that is merely fine. A brand
 * owing you late money is not in the same situation as one quietly delivering.
 */
function isOverdue(b: BrandRollup): boolean {
  return b.overdue > 0;
}

/**
 * "Live" means work is actually moving: a project under way, tasks outstanding,
 * or an invoice out. A project marked active with no start date and no progress
 * is agreed, not running, so it belongs in Not started.
 *
 * A proposal in play is deliberately NOT live, nothing has been won yet, so it
 * belongs in Proposed where it reads as a decision pending.
 */
function isLive(b: BrandRollup): boolean {
  if (isOverdue(b)) return false;
  // Money outstanding keeps a brand live even with no work running: an unpaid
  // invoice still needs chasing.
  return b.runningProjects > 0 || b.unpaidCount > 0 || b.openTasks > 0;
}

/** Agreed with a start date still ahead of it. */
function notStarted(b: BrandRollup): boolean {
  return !isOverdue(b) && !isLive(b) && b.notStartedProjects > 0;
}

/** Money quoted and waiting on their answer, with nothing running yet. */
function monthYear(iso: string) {
  return new Date(iso.slice(0, 10) + "T00:00:00")
    .toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** The date a completed brand was last worked with, for the year headings. */
function lastActive(b: BrandRollup): string | null {
  return b.last_seen ?? b.first_seen ?? null;
}

/**
 * Completed brands grouped by year, newest first, the way a photo library
 * groups by date. Thirty-two cards in one alphabetical block tell you who you
 * have worked with and nothing about when, which is the question that list is
 * usually being asked.
 */
function byYear(rows: BrandRollup[]) {
  const map = new Map<string, BrandRollup[]>();
  for (const b of rows) {
    const d = lastActive(b);
    const key = d ? d.slice(0, 4) : "undated";
    const list = map.get(key);
    if (list) list.push(b); else map.set(key, [b]);
  }
  return Array.from(map.entries())
    // Undated last: it is not a year and must not sort among them.
    .sort((a, b) => (a[0] === "undated" ? 1 : b[0] === "undated" ? -1 : b[0].localeCompare(a[0])))
    .map(([year, list]) => ({
      year,
      rows: list.sort((x, y) => (lastActive(y) ?? "").localeCompare(lastActive(x) ?? "")),
    }));
}

function isProposed(b: BrandRollup): boolean {
  return !isLive(b) && b.pipeline > 0;
}

/** One line saying what is actually happening, or why nothing is. */
function summarise(b: BrandRollup): string {
  const bits: string[] = [];
  // Running and not-started are named apart, so "1 project open" never covers
  // for work nobody has begun.
  if (b.runningProjects > 0) bits.push(`${b.runningProjects} project${b.runningProjects === 1 ? "" : "s"} running`);
  if (b.notStartedProjects > 0) bits.push(`${b.notStartedProjects} due to start`);
  // Parked is named rather than folded into "open", so a shelved project never
  // reads as work in progress.
  if (b.parkedProjects > 0) bits.push(`${b.parkedProjects} parked`);
  if (b.openTasks > 0) bits.push(`${b.openTasks} open task${b.openTasks === 1 ? "" : "s"}`);
  // An invoice with no amount recorded still needs chasing, so say so rather
  // than letting it sum to zero and disappear.
  if (b.owed > 0) bits.push(`${moneyShort(b.owed)} outstanding`);
  else if (b.unpaidCount > 0) {
    bits.push(`${b.unpaidCount} invoice${b.unpaidCount === 1 ? "" : "s"} out · amount not recorded`);
  }
  if (b.pipeline > 0) bits.push(`${moneyShort(b.pipeline)} in play`);
  if (bits.length) return bits.join(" · ");
  if (b.collected > 0) return `${moneyShort(b.collected)} collected · nothing open`;
  // lifetime_revenue comes off the billing vault, so a brand billed in 2022
  // reports what it was worth instead of claiming nothing was ever recorded.
  if (b.lifetime_revenue) {
    const when = b.last_seen ? ` ${monthYear(b.last_seen)}` : "";
    // A brand whose only document was a quote was never billed, so it says
    // quoted. Reporting it as revenue would count work that never happened.
    const verb = kindOf(b) === "prospect" ? "quoted" : "billed";
    return `${moneyShort(b.lifetime_revenue)} ${verb}${when ? ` · last ${when.trim()}` : ""}`;
  }
  if (b.projectCount > 0) return "No active work";
  return "Nothing recorded yet";
}

function BrandCard({ b }: { b: BrandRollup }) {
  // Dot matches the group the card sits in, so a proposed brand doesn't read as
  // dormant just because no work has started.
  const dot = isOverdue(b) ? "#e5484d"
    : isLive(b) ? "#00d4aa"
    : notStarted(b) ? "#3b82f6"
    : isProposed(b) || (kindOf(b) === "prospect" && b.pipeline > 0) ? "#f59e0b"
    : "#6b6b6b";
  return (
    <Link
      href={`/dashboard/brands/${b.id}`}
      className="metric-card flex items-center gap-3 rounded-xl border border-[var(--border)] bg-surface p-3"
    >
      <BrandMark name={b.name} logoUrl={b.logo_url} color={b.color} size={36} radius="rounded-lg" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13.5px] font-semibold text-text">{b.name}</span>
          {b.overdue > 0 && (
            <span className="shrink-0 rounded bg-[rgba(229,72,77,0.14)] px-1 text-[8.5px] font-bold uppercase text-accent-red">
              overdue
            </span>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: dot }}
          />
          <span className="truncate">{summarise(b)}</span>
        </span>
      </span>
      <ChevronRight size={14} className="shrink-0 text-text-muted" />
    </Link>
  );
}

function Group({ title, count, color, children }: {
  title: string; count: number; color: string; children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {title}
        <span>({count})</span>
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [signals, setSignals] = useState<OpsSignal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    const j = (url: string) => fetch(url).then((r) => r.json()).catch(() => []);
    const [br, pr, pay, prop, sig] = await Promise.all([
      j("/api/ops/brands"), j("/api/ops/projects"), j("/api/ops/payments"),
      j("/api/ops/proposals"), j("/api/ops/alerts"),
    ]);
    setBrands(Array.isArray(br) ? br : []);
    setProjects(Array.isArray(pr) ? pr : []);
    setPayments(Array.isArray(pay) ? pay : []);
    setProposals(Array.isArray(prop) ? prop : []);
    setSignals(Array.isArray(sig) ? sig : []);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addBrand() {
    const name = newName.trim();
    if (!name) return;
    await fetch("/api/ops/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setNewName("");
    setAdding(false);
    load();
  }

  const rolled = useMemo(
    () => rollupAll(brands, projects, payments, proposals, signals),
    [brands, projects, payments, proposals, signals]
  );

  // Order is deliberate: what's running, then what's pending a decision, then
  // the archive, then everyone who isn't a client at all.
  const clients = rolled.filter((b) => kindOf(b) === "client");
  // A prospect is only pipeline while money is actually quoted and waiting.
  // Swiftlearnings was quoted in 2021 and Venture Out in 2022; neither is a
  // live opportunity, and showing them as Proposed put five-year-old history
  // in the place reserved for decisions still pending. With no pipeline they
  // fall through to Completed, where the year headings file them correctly.
  const prospects = rolled.filter((b) => kindOf(b) === "prospect" && b.pipeline > 0);
  const archivedProspects = rolled.filter((b) => kindOf(b) === "prospect" && b.pipeline <= 0);

  const overdue = clients.filter(isOverdue);
  const live = clients.filter(isLive);
  const upcoming = clients.filter(notStarted);
  // A prospect is a proposal by definition, so it sits here rather than in a
  // group of its own, the distinction is bookkeeping, not something to act on.
  const proposed = [...clients.filter(isProposed), ...prospects];
  const done = [
    ...clients.filter((b) => !isOverdue(b) && !isLive(b) && !notStarted(b) && !isProposed(b)),
    ...archivedProspects,
  ];

  const groups: { key: string; title: string; color: string; rows: BrandRollup[] }[] = [
    { key: "overdue", title: "Overdue", color: "#e5484d", rows: overdue },
    { key: "live", title: "Live", color: "#00d4aa", rows: live },
    { key: "upcoming", title: "Due to start", color: "#3b82f6", rows: upcoming },
    { key: "proposed", title: "Proposed", color: "#f59e0b", rows: proposed },
    { key: "done", title: "Completed", color: "#6b6b6b", rows: done },
    ...(["agency", "partner", "own"] as BrandKind[]).map((k) => ({
      key: k,
      title: BRAND_KIND_LABEL[k],
      color: KIND_COLOR[k],
      rows: rolled.filter((b) => kindOf(b) === k),
    })),
  ].filter((g) => g.rows.length > 0);

  return (
    <div className="page space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Boxes size={19} className="text-text-muted" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text">Brands</h1>
            <p className="mt-0.5 text-[12.5px] text-text-muted">
              What&apos;s live right now. Open one to see everything on it
            </p>
          </div>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-text px-3 py-1.5 text-[12px] font-medium text-bg"
        >
          <Plus size={13} /> Add brand
        </button>
      </header>

      {adding && (
        <div className="flex gap-2 rounded-xl border border-[var(--border)] bg-surface p-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addBrand()}
            placeholder="Brand name (must match the client name used on projects and payments)"
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-2.5 py-1.5 text-[12.5px] text-text placeholder:text-text-muted"
          />
          <button onClick={addBrand} className="rounded-lg bg-text px-3 py-1.5 text-[12px] font-medium text-bg">
            Create
          </button>
        </div>
      )}

      {!loaded ? (
        <p className="py-12 text-center text-[13px] text-text-muted">Loading…</p>
      ) : rolled.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] px-6 py-14 text-center">
          <p className="text-[13px] text-text-muted">No brands yet. Add one above.</p>
        </div>
      ) : (
        <>
          {groups.map((g) => (
            g.key === "done" ? (
              <section key={g.key} className="space-y-3">
                <h2 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: g.color }} />
                  {g.title}
                  <span>({g.rows.length})</span>
                </h2>
                {byYear(g.rows).map((yr) => (
                  <div key={yr.year} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="shrink-0 text-[13px] font-semibold text-text">
                        {yr.year === "undated" ? "No date recorded" : yr.year}
                      </h3>
                      <span className="h-px flex-1 bg-[var(--border)]" />
                      <span className="shrink-0 text-[10.5px] tabular-nums text-text-muted">{yr.rows.length}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {yr.rows.map((b) => <BrandCard key={b.id} b={b} />)}
                    </div>
                  </div>
                ))}
              </section>
            ) : (
              <Group key={g.key} title={g.title} count={g.rows.length} color={g.color}>
                {g.rows.map((b) => <BrandCard key={b.id} b={b} />)}
              </Group>
            )
          ))}
        </>
      )}
    </div>
  );
}
