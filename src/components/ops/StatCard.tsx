"use client";

import type { LucideIcon } from "lucide-react";

export type StatAccent = "red" | "amber" | "green" | "violet";

const ACCENT: Record<StatAccent, { hex: string; tintFrom: string; tintTo: string }> = {
  red:    { hex: "#e5484d", tintFrom: "rgba(229,72,77,0.13)",  tintTo: "rgba(229,72,77,0)" },
  amber:  { hex: "#f59e0b", tintFrom: "rgba(245,158,11,0.13)", tintTo: "rgba(245,158,11,0)" },
  green:  { hex: "#00d4aa", tintFrom: "rgba(0,212,170,0.13)",  tintTo: "rgba(0,212,170,0)" },
  violet: { hex: "#8b5cf6", tintFrom: "rgba(139,92,246,0.13)", tintTo: "rgba(139,92,246,0)" },
};

/** Accent-stroked sparkline with a soft area fill. Renders nothing below 2 points. */
function StatSpark({ values, color, id }: { values: number[]; color: string; id: string }) {
  const pts = values.filter((v) => Number.isFinite(v));
  if (pts.length < 2) return null;

  const w = 118;
  const h = 44;
  const pad = 3;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;

  const xy = pts.map((v, i) => {
    const x = pad + (i / (pts.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });

  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pad},${h} ${line} ${(w - pad).toFixed(1)},${h}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#spark-${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  series,
  id,
  delta,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  accent: StatAccent;
  series: number[];
  id: string;
  /** Footer comparison, e.g. { text: "2 vs yesterday", dir: "up" }. */
  delta?: { text: string; dir: "up" | "down" | "flat" } | null;
}) {
  const a = ACCENT[accent];
  return (
    <div
      className="metric-card relative overflow-hidden rounded-2xl border border-[var(--border)]"
      style={{ background: `linear-gradient(135deg, ${a.tintFrom} 0%, ${a.tintTo} 62%), var(--surface)` }}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: a.hex }}
        >
          <Icon size={17} strokeWidth={2.2} color="#fff" />
        </div>

        <div className="min-w-0 flex-1">
          {/* Tighter tracking + no truncation: these labels are short enough to
              wrap to two lines, which reads far better than "MONEY WAI…". */}
          <p
            className="text-[10px] font-semibold uppercase leading-tight tracking-[0.06em]"
            style={{ color: a.hex }}
          >
            {label}
          </p>
          <p className="mt-1 text-[26px] font-bold leading-none tracking-tight tabular-nums text-text">
            {value}
          </p>
          <p className="mt-1.5 text-[11px] leading-tight text-text-muted">{sub}</p>
        </div>

        {/* Only shown where there's genuinely room — below 2xl the four cards sit
            too narrow and the sparkline squeezes the label into an ellipsis. */}
        <div className="hidden self-center 2xl:block">
          <StatSpark values={series} color={a.hex} id={id} />
        </div>
      </div>

      {delta && (
        <div className="border-t border-[var(--border)] px-4 py-2">
          <p className="flex items-center gap-1 truncate text-[11px]" style={{ color: a.hex }}>
            <span aria-hidden="true">{delta.dir === "down" ? "↓" : delta.dir === "flat" ? "→" : "↑"}</span>
            {delta.text}
          </p>
        </div>
      )}
    </div>
  );
}
