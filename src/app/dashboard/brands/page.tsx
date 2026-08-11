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
 * "Live" means work is actually moving: a project open, an invoice out, tasks
 * outstanding. A proposal in play is deliberately NOT live — nothing has been
 * won yet, so it belongs in Proposed where it reads as a decision pending
 * rather than as work in progress.
 */
function isLive(b: BrandRollup): boolean {
  return b.openProjects > 0 || b.unpaidCount > 0 || b.openTasks > 0;
}

/** Money quoted and waiting on their answer, with nothing running yet. */
function isProposed(b: BrandRollup): boolean {
  return !isLive(b) && b.pipeline > 0;
}

/** One line saying what is actually happening, or why nothing is. */
function summarise(b: BrandRollup): string {
  const bits: string[] = [];
  if (b.openProjects > 0) bits.push(`${b.openProjects} project${b.openProjects === 1 ? "" : "s"} open`);
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
  if (b.projectCount > 0) return "No active work";
  return "Nothing recorded yet";
}

function BrandCard({ b }: { b: BrandRollup }) {
  // Dot matches the group the card sits in, so a proposed brand doesn't read as
  // dormant just because no work has started.
  const dot = isLive(b) ? "#00d4aa" : isProposed(b) || kindOf(b) === "prospect" ? "#f59e0b" : "#6b6b6b";
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
  const prospects = rolled.filter((b) => kindOf(b) === "prospect");

  const live = clients.filter(isLive);
  // A prospect is a proposal by definition, so it sits here rather than in a
  // group of its own — the distinction is bookkeeping, not something to act on.
  const proposed = [...clients.filter(isProposed), ...prospects];
  const done = clients.filter((b) => !isLive(b) && !isProposed(b));

  const groups: { key: string; title: string; color: string; rows: BrandRollup[] }[] = [
    { key: "live", title: "Live", color: "#00d4aa", rows: live },
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
    <div className="space-y-5 px-4 pb-24 pt-4 sm:px-5 lg:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Boxes size={19} className="text-text-muted" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text">Brands</h1>
            <p className="mt-0.5 text-[12.5px] text-text-muted">
              What&apos;s live right now — open one to see everything on it
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
            placeholder="Brand name — must match the client name used on projects & payments"
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
            <Group key={g.key} title={g.title} count={g.rows.length} color={g.color}>
              {g.rows.map((b) => <BrandCard key={b.id} b={b} />)}
            </Group>
          ))}
        </>
      )}
    </div>
  );
}
