"use client";

import Link from "next/link";
import { initials, avatarColor, moneyShort } from "@/lib/format";
import type { Project } from "@/types/ops";

const DAY = 86_400_000;

export type TimelineRow = Project & { daysLeft: number | null; openTasks: number };

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function parse(d: string | null): number | null {
  if (!d) return null;
  const t = new Date(d.length <= 10 ? d + "T00:00:00" : d).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Gantt-style view of everything in flight.
 *
 * The window is derived from the real project dates rather than a fixed range,
 * then padded so bars never touch the edges. Projects missing a start or end are
 * still listed, with an explicit marker instead of a bar, because silently
 * dropping them would hide work that is genuinely running.
 */
export function Timeline({ rows }: { rows: TimelineRow[] }) {
  const today = startOfDay(new Date()).getTime();

  const starts = rows.map((r) => parse(r.start_date)).filter((x): x is number => x != null);
  const ends = rows.map((r) => parse(r.end_date)).filter((x): x is number => x != null);

  const rawMin = Math.min(...starts, today);
  const rawMax = Math.max(...ends, today);
  // Pad by a week either side, and guarantee a non-zero span.
  const min = rawMin - 7 * DAY;
  const max = Math.max(rawMax + 7 * DAY, min + 30 * DAY);
  const span = max - min;

  const pct = (t: number) => ((t - min) / span) * 100;

  // One tick per month boundary inside the window.
  const ticks: { label: string; left: number }[] = [];
  const cursor = new Date(min);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  while (cursor.getTime() <= max) {
    const t = cursor.getTime();
    if (t >= min) {
      ticks.push({
        label: cursor.toLocaleDateString("en-GB", { month: "short" }),
        left: pct(t),
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  if (rows.length === 0) {
    return <p className="px-4 py-10 text-center text-[12px] text-text-muted">Nothing in flight.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Month scale */}
        <div className="relative mb-1 ml-[220px] h-4 border-b border-[var(--border)]">
          {ticks.map((t) => (
            <span
              key={`${t.label}-${t.left}`}
              className="absolute top-0 -translate-x-1/2 text-[9px] uppercase tracking-wide text-text-muted"
              style={{ left: `${t.left}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>

        <div className="relative">
          {/* Month gridlines + today marker, behind the bars */}
          <div className="pointer-events-none absolute inset-0 ml-[220px]">
            {ticks.map((t) => (
              <span
                key={`grid-${t.left}`}
                className="absolute inset-y-0 w-px bg-[var(--border)]"
                style={{ left: `${t.left}%` }}
              />
            ))}
            <span
              className="absolute inset-y-0 w-px bg-accent-red"
              style={{ left: `${pct(today)}%` }}
              title="Today"
            />
          </div>

          <ul className="relative">
            {rows.map((r) => {
              const s = parse(r.start_date);
              const e = parse(r.end_date);
              const late = r.daysLeft != null && r.daysLeft < 0;
              const soon = r.daysLeft != null && r.daysLeft >= 0 && r.daysLeft <= 7;
              const color = late ? "#e5484d" : soon ? "#f59e0b" : "#8b5cf6";
              const progress = Math.max(0, Math.min(100, r.progress ?? 0));

              // Both dates → a real bar. One date → a short stub so the row still
              // reads on the axis. Neither → no bar, flagged in the label column.
              const barLeft = s != null ? pct(s) : e != null ? pct(e) - 2 : null;
              const barWidth =
                s != null && e != null ? Math.max(1.2, pct(e) - pct(s)) : s != null || e != null ? 2 : null;

              return (
                <li key={r.id} className="flex items-center border-t border-[var(--border)] py-2">
                  <div className="flex w-[220px] shrink-0 items-center gap-2 pr-3">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[8px] font-bold text-white"
                      style={{ background: avatarColor(r.client) }}
                    >
                      {initials(r.client)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Link
                        href="/dashboard/ops/projects"
                        className="block truncate text-[12px] font-medium text-text hover:underline"
                      >
                        {r.name}
                      </Link>
                      <span className="block truncate text-[9.5px] text-text-muted">
                        {r.client ?? "-"}
                        {r.budget != null && ` · ${moneyShort(r.budget)}`}
                        {!r.start_date && !r.end_date
                          ? " · no dates"
                          : r.start_date && !r.end_date
                            ? " · no end date"
                            : !r.start_date && r.end_date
                              ? " · no start date"
                              : ""}
                      </span>
                    </span>
                  </div>

                  <div className="relative h-6 min-w-0 flex-1">
                    {barLeft != null && barWidth != null && (
                      <div
                        className="absolute top-1/2 h-4 -translate-y-1/2 overflow-hidden rounded"
                        style={{
                          left: `${barLeft}%`,
                          width: `${barWidth}%`,
                          background: `${color}33`,
                          border: `1px solid ${color}66`,
                        }}
                        title={`${r.start_date ?? "?"} → ${r.end_date ?? "?"} · ${progress}%`}
                      >
                        <div className="h-full" style={{ width: `${progress}%`, background: color }} />
                      </div>
                    )}
                  </div>

                  <div className="w-[86px] shrink-0 pl-2 text-right">
                    <span
                      className={`block text-[10px] ${
                        late ? "font-medium text-accent-red" : soon ? "font-medium text-accent-orange" : "text-text-muted"
                      }`}
                    >
                      {/* daysLeft comes from end_date alone, so a project that
                          has a start but no end used to report "no date" even
                          though it plainly has one. Say which date is missing. */}
                      {r.daysLeft != null
                        ? late ? `${Math.abs(r.daysLeft)}d over` : `${r.daysLeft}d left`
                        : s != null
                          ? `day ${Math.max(1, Math.round((today - s) / DAY) + 1)}`
                          : "no dates"}
                    </span>
                    <span className="block text-[9.5px] tabular-nums text-text-muted">
                      {progress}% · {r.openTasks} open
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
