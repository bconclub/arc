"use client";

import type { SystemService, ServiceStatus } from "@/types/ops";

const STATUS: Record<ServiceStatus, { label: string; color: string }> = {
  healthy: { label: "HEALTHY", color: "#00d4aa" },
  issue:   { label: "ISSUE",   color: "#f59e0b" },
  paused:  { label: "PAUSED",  color: "#f59e0b" },
  failed:  { label: "FAILED",  color: "#e5484d" },
  down:    { label: "DOWN",    color: "#e5484d" },
};

/** Two-letter fallback mark when a service has no icon asset. */
function mark(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function ServiceNode({ s }: { s: SystemService }) {
  const st = STATUS[s.status] ?? STATUS.healthy;
  const degraded = s.status !== "healthy";
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl border bg-[var(--surface-hover)] px-2.5 py-2"
      style={{ borderColor: degraded ? `${st.color}55` : "var(--border)" }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
        style={{ background: st.color }}
      >
        {mark(s.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-text">{s.name}</span>
        <span className="block truncate text-[10px] text-text-muted">{s.category ?? "-"}</span>
      </span>
      <span
        className="shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wide"
        style={{ background: `${st.color}22`, color: st.color }}
      >
        {st.label}
      </span>
    </div>
  );
}

/**
 * SystemService status laid out around a central ARC node. The connector lines are a
 * percentage-based SVG behind a 3-column grid, so they stay aligned at any width
 * without measuring the DOM. Below `lg` the graph collapses to a plain list.
 */
export function OperationsHealth({ services }: { services: SystemService[] }) {
  if (services.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-[12px] text-text-muted">
        No systems tracked yet. Run the migration to seed <code>system_health</code>,
        then hit “Test all connections” in Admin.
      </p>
    );
  }

  const half = Math.ceil(services.length / 2);
  const left = services.slice(0, half);
  const right = services.slice(half);
  const down = services.filter((s) => s.status === "down" || s.status === "failed").length;
  const anchor = (n: number, i: number) => (n <= 1 ? 50 : 14 + (i / (n - 1)) * 72);

  return (
    <div className="px-4 pb-4">
      {/* Graph, lg and up */}
      <div className="relative hidden lg:block">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {left.map((s, i) => (
            <line
              key={`l-${s.id}`}
              x1="32" y1={anchor(left.length, i)} x2="50" y2="50"
              stroke={STATUS[s.status]?.color ?? "#6b6b6b"}
              strokeWidth="0.4" opacity="0.5" vectorEffect="non-scaling-stroke"
            />
          ))}
          {right.map((s, i) => (
            <line
              key={`r-${s.id}`}
              x1="68" y1={anchor(right.length, i)} x2="50" y2="50"
              stroke={STATUS[s.status]?.color ?? "#6b6b6b"}
              strokeWidth="0.4" opacity="0.5" vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="space-y-2">{left.map((s) => <ServiceNode key={s.id} s={s} />)}</div>

          <div
            className="flex h-16 w-16 flex-col items-center justify-center rounded-full border-2"
            style={{
              borderColor: down > 0 ? "#e5484d" : "#00d4aa",
              background: "var(--surface)",
              boxShadow: `0 0 24px ${down > 0 ? "rgba(229,72,77,0.28)" : "rgba(0,212,170,0.22)"}`,
            }}
          >
            <span className="text-[15px] font-extrabold tracking-tight text-text">ARC</span>
            <span className="text-[8px]" style={{ color: down > 0 ? "#e5484d" : "#00d4aa" }}>
              {down > 0 ? `${down} down` : "all up"}
            </span>
          </div>

          <div className="space-y-2">{right.map((s) => <ServiceNode key={s.id} s={s} />)}</div>
        </div>
      </div>

      {/* List, below lg */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:hidden">
        {services.map((s) => <ServiceNode key={s.id} s={s} />)}
      </div>
    </div>
  );
}
