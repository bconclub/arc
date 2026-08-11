"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";

/**
 * The header stat row from the reference: lime circular icon badge, big number,
 * one-line descriptor, optional delta chip.
 *
 * `delta` is deliberately optional and has no default. The reference shows
 * "↓2 from yesterday" on every card, but ARC stores current state only, there
 * is no record of what these counts were yesterday, so for most stats there is
 * nothing to compare against. Cards render without the chip until a snapshot
 * history exists; an invented delta on a money figure is worse than none.
 */

export type Delta = {
  value: number;
  /** e.g. "from yesterday", "vs last week", the period being compared. */
  label: string;
  /** Whether a rise is good. Money collected up = good; overdue up = bad. */
  upIsGood?: boolean;
  /** Render as a percentage rather than a count. */
  percent?: boolean;
};

export type Stat = {
  key: string;
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  delta?: Delta;
  /** Tints the value, for figures that are bad news, like overdue. */
  valueClass?: string;
  href?: string;
};

function DeltaChip({ d }: { d: Delta }) {
  if (d.value === 0) return null;
  const up = d.value > 0;
  const good = up === (d.upIsGood ?? true);
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[10px] font-semibold ${
        good ? "bg-[rgba(0,212,170,0.14)] text-accent-green" : "bg-[rgba(255,68,68,0.14)] text-accent-red"
      }`}
    >
      <Icon size={10} strokeWidth={2.6} />
      {Math.abs(d.value)}
      {d.percent ? "%" : ""} {d.label}
    </span>
  );
}

export function StatCardBlock({ stat }: { stat: Stat }) {
  const Icon = stat.icon;
  return (
    <div className="flex flex-col gap-3 rounded-panel border border-[var(--border)] bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-[var(--brand-soft)]">
            <Icon size={17} className="text-[var(--brand-text)]" strokeWidth={2} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-medium text-text-muted">{stat.label}</span>
          <span className={`mt-0.5 block truncate text-[26px] font-bold leading-tight tracking-tight tabular-nums ${stat.valueClass ?? "text-text"}`}>
            {stat.value}
          </span>
        </span>
      </div>
      {(stat.hint || stat.delta) && (
        <div className="flex flex-wrap items-center gap-2">
          {stat.hint && <span className="text-[11px] text-text-muted">{stat.hint}</span>}
          {stat.delta && <DeltaChip d={stat.delta} />}
        </div>
      )}
    </div>
  );
}

/** Column count follows the number of stats, so a five-stat strip does not
 *  leave one card orphaned on its own row. */
const COLS: Record<number, string> = {
  1: "xl:grid-cols-1",
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
};

export function StatStrip({ stats, className = "" }: { stats: Stat[]; className?: string }) {
  const cols = COLS[stats.length] ?? "xl:grid-cols-4";
  return (
    <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ${cols} ${className}`}>
      {stats.map((s) => <StatCardBlock key={s.key} stat={s} />)}
    </div>
  );
}
