"use client";

import { useMemo } from "react";
import { BrandMark } from "@/components/ops/BrandMark";
import { deliverableOf } from "@/lib/format";
import type { Brand, Project } from "@/types/ops";

const DAY = 86_400_000;

/** Days shown: today plus the next two and a half weeks. */
export const HORIZON = 18;

const STATUS_COLOR: Record<string, string> = {
  active: "#00d4aa",
  waiting: "#f59e0b",
  parked: "#6b6b6b",
  done: "#3b82f6",
};

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function dayIndex(iso: string | null, from: Date) {
  if (!iso) return null;
  const t = new Date(iso.slice(0, 10) + "T00:00:00").getTime();
  if (!Number.isFinite(t)) return null;
  return Math.round((t - from.getTime()) / DAY);
}

/**
 * What is running now and what lands in the next 18 days.
 *
 * A project with no dates cannot be drawn on a calendar, and inventing a bar
 * for it would put a deadline on screen that nobody agreed. Those are listed
 * underneath instead, named as undated, so they are still visible without
 * being fictional.
 */
export function ProjectTimeline({
  projects, brands, onOpen,
}: {
  projects: Project[];
  brands: Brand[];
  onOpen: (p: Project) => void;
}) {
  const today = startOfDay(new Date());

  const brandOf = useMemo(() => {
    const m = new Map<string, Brand>();
    const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const b of brands) {
      m.set(key(b.name), b);
      for (const a of b.aliases ?? []) m.set(key(a), b);
    }
    return (client: string | null) => (client ? m.get(key(client)) : undefined);
  }, [brands]);

  const days = useMemo(
    () => Array.from({ length: HORIZON }, (_, i) => new Date(today.getTime() + i * DAY)),
    [today],
  );

  const { bars, undated } = useMemo(() => {
    const open = projects.filter((p) => p.status === "active" || p.status === "waiting");
    const bars: { p: Project; start: number; span: number; openEnded: boolean }[] = [];
    const undated: Project[] = [];

    for (const p of open) {
      const s = dayIndex(p.start_date, today);
      const e = dayIndex(p.end_date, today);
      if (s == null && e == null) { undated.push(p); continue; }

      // A project already under way is clamped to today rather than drawn off
      // the left edge; the bar answers "what is left", not "what it looked like
      // when it started".
      const start = Math.max(0, s ?? 0);
      // No end date means open ended, not ending today. It runs to the edge of
      // the horizon and is marked so the edge does not read as a deadline.
      const openEnded = e == null;
      const end = openEnded ? HORIZON - 1 : e;
      if (end < 0) continue;                 // finished before today
      if (start > HORIZON - 1) continue;     // starts beyond the horizon
      bars.push({ p, start, span: Math.max(1, Math.min(HORIZON - 1, end) - start + 1), openEnded });
    }
    bars.sort((a, b) => a.start - b.start || (a.p.client ?? "").localeCompare(b.p.client ?? ""));
    return { bars, undated };
  }, [projects, today]);

  return (
    <section className="overflow-hidden rounded-panel border border-[var(--border)] bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-text">Next {HORIZON} days</h2>
        <p className="text-[11px] text-text-muted">
          {bars.length} on the calendar
          {undated.length > 0 && ` · ${undated.length} with no dates`}
        </p>
      </div>

      <div className="overflow-x-auto px-4 pb-4 pt-3">
        <div className="min-w-[720px]">
          {/* Day ruler */}
          <div className="mb-1.5 flex gap-px pl-[168px]">
            {days.map((d, i) => {
              const weekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div key={i} className="flex-1 text-center">
                  <div className={`text-[9px] uppercase ${weekend ? "text-text-muted opacity-50" : "text-text-muted"}`}>
                    {d.toLocaleDateString("en-GB", { weekday: "narrow" })}
                  </div>
                  <div className={`text-[10.5px] tabular-nums ${i === 0 ? "font-bold text-[var(--brand-text)]" : "text-text-muted"}`}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {bars.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-text-muted">
              Nothing scheduled in the next {HORIZON} days.
            </p>
          ) : (
            <div className="space-y-1.5">
              {bars.map(({ p, start, span, openEnded }) => {
                const color = STATUS_COLOR[p.status] ?? "#6b6b6b";
                const brand = brandOf(p.client);
                const progress = Math.max(0, Math.min(100, p.progress ?? 0));
                return (
                  <div key={p.id} className="flex items-center gap-2">
                    <button
                      onClick={() => onOpen(p)}
                      className="flex w-[160px] shrink-0 items-center gap-2 overflow-hidden text-left"
                    >
                      <BrandMark name={p.client ?? p.name} logoUrl={brand?.logo_url} color={brand?.color} size={22} radius="rounded-md" />
                      <span className="min-w-0">
                        <span className="block truncate text-[11.5px] font-medium text-text">
                          {deliverableOf(p.name, p.client)}
                        </span>
                        <span className="block truncate text-[9.5px] text-text-muted">{p.client ?? "No client"}</span>
                      </span>
                    </button>

                    <div className="relative flex flex-1 gap-px">
                      {days.map((d, i) => (
                        <div
                          key={i}
                          className={`h-8 flex-1 rounded-[3px] ${
                            d.getDay() === 0 || d.getDay() === 6 ? "bg-[var(--surface-hover)] opacity-40" : "bg-[var(--surface-hover)] opacity-70"
                          }`}
                        />
                      ))}
                      <button
                        onClick={() => onOpen(p)}
                        title={`${p.name} · ${p.status}${openEnded ? " · no end date" : ""}`}
                        className="absolute inset-y-0 flex items-center overflow-hidden rounded-md px-2 text-left"
                        style={{
                          left: `${(start / HORIZON) * 100}%`,
                          width: `${(span / HORIZON) * 100}%`,
                          background: `${color}2e`,
                          border: `1px solid ${color}`,
                          // An open-ended bar fades out rather than stopping
                          // flat, which would read as a date somebody set.
                          maskImage: openEnded ? "linear-gradient(to right, black 70%, transparent)" : undefined,
                          WebkitMaskImage: openEnded ? "linear-gradient(to right, black 70%, transparent)" : undefined,
                        }}
                      >
                        <span className="truncate text-[10px] font-semibold" style={{ color }}>
                          {progress > 0 ? `${progress}%` : p.status}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {undated.length > 0 && (
            <div className="mt-3 border-t border-[var(--border)] pt-2.5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                No dates set, so not on the calendar
              </p>
              <div className="flex flex-wrap gap-1.5">
                {undated.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onOpen(p)}
                    className="flex items-center gap-1.5 rounded-pill border border-[var(--border)] px-2 py-1 text-[11px] text-text-muted transition-colors hover:text-text"
                  >
                    <BrandMark name={p.client ?? p.name} logoUrl={brandOf(p.client)?.logo_url} color={brandOf(p.client)?.color} size={15} radius="rounded" />
                    <span className="max-w-[180px] truncate">{deliverableOf(p.name, p.client)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
