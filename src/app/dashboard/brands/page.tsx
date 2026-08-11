"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, Plus, ChevronRight } from "lucide-react";
import { moneyShort, avatarColor } from "@/lib/format";
import { rollupAll } from "@/lib/rollup";
import { HealthRing, TrendLine } from "@/components/ops/Charts";
import { BrandMark } from "@/components/ops/BrandMark";
import { BRAND_KIND_LABEL, type Brand, type BrandKind, type Project, type Payment, type Proposal, type OpsSignal } from "@/types/ops";

// Status values come from the client register, which can add its own — always
// fall through to a neutral colour rather than indexing blind.
const STATUS_COLOR: Record<string, string> = {
  active: "#00d4aa",
  on_track: "#00d4aa",
  at_risk: "#f59e0b",
  paused: "#f59e0b",
  dormant: "#6b6b6b",
  archived: "#6b6b6b",
  lost: "#e5484d",
};

const statusColor = (s: string) => STATUS_COLOR[s] ?? "#6b6b6b";

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

// Clients first — they are the ones with money attached.
const KIND_ORDER: BrandKind[] = ["client", "agency", "partner", "prospect", "own"];

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

  /** id -> name, so a card can say "via Now Media" without another fetch. */
  const viaName = useMemo(
    () => Object.fromEntries(brands.map((b) => [b.id, b.name])) as Record<string, string>,
    [brands]
  );

  return (
    <div className="space-y-4 px-4 pb-24 pt-4 sm:px-5 lg:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Boxes size={19} className="text-text-muted" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text">Brands</h1>
            <p className="mt-0.5 text-[12.5px] text-text-muted">
              Health of every brand across projects, money, pipeline and repos
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
          <p className="text-[13px] text-text-muted">
            No brands yet. Run the <code className="rounded bg-[var(--surface-hover)] px-1">brands_services</code> migration
            to seed them, or add one above.
          </p>
        </div>
      ) : (
        KIND_ORDER.filter((k) => rolled.some((b) => kindOf(b) === k)).map((kind) => (
        <section key={kind} className="space-y-2">
          <h2 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: KIND_COLOR[kind] }} />
            {BRAND_KIND_LABEL[kind]}
            <span className="text-text-muted">({rolled.filter((b) => kindOf(b) === kind).length})</span>
          </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rolled.filter((b) => kindOf(b) === kind).map((b) => {
            const accent = b.color ?? avatarColor(b.name);
            return (
              <Link
                key={b.id}
                href={`/dashboard/brands/${b.id}`}
                className="metric-card flex flex-col rounded-2xl border border-[var(--border)] bg-surface p-4"
              >
                <div className="flex items-center gap-2.5">
                  <BrandMark
                    name={b.name} logoUrl={b.logo_url} domains={b.domains}
                    color={b.color} size={40} radius="rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-text">{b.name}</p>
                    <p className="flex items-center gap-1 text-[11px] text-text-muted">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor(b.status) }} />
                      {b.status.replace("_", " ")}
                      {b.via_brand_id && viaName[b.via_brand_id] ? ` · via ${viaName[b.via_brand_id]}` : ""}
                      {b.github_repos?.length ? ` · ${b.github_repos.length} repo${b.github_repos.length === 1 ? "" : "s"}` : ""}
                    </p>
                  </div>
                  <HealthRing score={b.health} size={44} thickness={4} />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-3">
                  <div>
                    <p className="text-[13.5px] font-semibold tabular-nums text-text">{moneyShort(b.owed)}</p>
                    <p className="text-[9.5px] text-text-muted">Out there</p>
                  </div>
                  <div>
                    <p className="text-[13.5px] font-semibold tabular-nums text-text">{moneyShort(b.collected)}</p>
                    <p className="text-[9.5px] text-text-muted">Collected</p>
                  </div>
                  <div>
                    <p className="text-[13.5px] font-semibold tabular-nums text-text">{moneyShort(b.pipeline)}</p>
                    <p className="text-[9.5px] text-text-muted">Pipeline</p>
                  </div>
                </div>

                <TrendLine values={b.moneySeries} color={accent} height={26} />

                <div className="mt-1 flex items-center justify-between text-[11px] text-text-muted">
                  <span>{b.activeProjects} active · {b.openTasks} open task{b.openTasks === 1 ? "" : "s"}</span>
                  <ChevronRight size={13} />
                </div>
              </Link>
            );
          })}
        </div>
        </section>
        ))
      )}
    </div>
  );
}
