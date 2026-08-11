"use client";

/** Inline-SVG chart primitives for the ARC dashboard. No chart library. */

export type Segment = { label: string; value: number; color: string };

/**
 * Ring chart. Renders segments proportionally; when everything is zero it draws
 * a flat track so the panel keeps its shape instead of collapsing.
 */
export function Donut({
  segments,
  size = 116,
  thickness = 13,
  center,
  sub,
  centerColor,
}: {
  segments: Segment[];
  size?: number;
  thickness?: number;
  center?: string;
  sub?: string;
  centerColor?: string;
}) {
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);

  let offset = 0;
  const arcs = total > 0
    ? segments.filter((s) => s.value > 0).map((s) => {
        const len = (s.value / total) * circ;
        const arc = { ...s, len, offset };
        offset += len;
        return arc;
      })
    : [];

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--border)" strokeWidth={thickness}
        />
        {arcs.map((a) => (
          <circle
            key={a.label}
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={thickness}
            strokeDasharray={`${a.len} ${circ - a.len}`}
            strokeDashoffset={-a.offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      {(center || sub) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-1">
          {center && (
            <span
              className="font-bold leading-none tabular-nums"
              style={{
                color: centerColor ?? "var(--text)",
                // Fit the label inside the ring. A value like "₹70,000" at a
                // fixed 20px spills straight over a 78px donut, which reads as
                // a rendering fault rather than a number.
                fontSize: Math.max(
                  9,
                  Math.min(20, ((size - thickness * 2) * 1.5) / Math.max(center.length, 1))
                ),
              }}
            >
              {center}
            </span>
          )}
          {sub && <span className="mt-0.5 text-[8px] text-text-muted">{sub}</span>}
        </div>
      )}
    </div>
  );
}

/** Single-value progress ring — used for brand health scores. */
export function HealthRing({
  score, size = 58, thickness = 5,
}: { score: number; size?: number; thickness?: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const color = clamped >= 75 ? "#00d4aa" : clamped >= 50 ? "#f59e0b" : "#e5484d";
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const len = (clamped / 100) * circ;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={thickness} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={thickness}
          strokeDasharray={`${len} ${circ - len}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[15px] font-bold tabular-nums" style={{ color }}>{clamped}</span>
      </div>
    </div>
  );
}

/** Vertical bars with labels underneath — the overdue-ageing breakdown. */
export function MiniBars({
  bars, height = 76, color = "#e5484d",
}: { bars: { label: string; value: number }[]; height?: number; color?: string }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height: height + 22 }}>
      {bars.map((b) => (
        <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end" style={{ height }}>
            <div
              className="w-full rounded-t transition-all"
              style={{
                height: `${Math.max(b.value > 0 ? 6 : 2, (b.value / max) * height)}px`,
                background: b.value > 0 ? color : "var(--border)",
              }}
              title={`${b.label}: ${b.value}`}
            />
          </div>
          <span className="whitespace-pre text-center text-[8px] leading-tight text-text-muted">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Stacked trapezoid funnel for the proposal pipeline. */
export function Funnel({
  stages, width = 200, height = 150,
}: { stages: { label: string; value: number; color: string }[]; width?: number; height?: number }) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  const bandH = height / stages.length;
  const gap = 3;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
      {stages.map((s, i) => {
        const next = stages[i + 1];
        const wTop = (Math.max(s.value, 0) / max) * width;
        const wBot = next ? (Math.max(next.value, 0) / max) * width : wTop * 0.55;
        const y = i * bandH;
        const h = bandH - gap;
        const topL = (width - wTop) / 2;
        const botL = (width - wBot) / 2;
        return (
          <polygon
            key={s.label}
            points={`${topL},${y} ${topL + wTop},${y} ${botL + wBot},${y + h} ${botL},${y + h}`}
            fill={s.color}
            opacity={0.88}
          />
        );
      })}
    </svg>
  );
}

/** Compact accent sparkline used inside brand cards and the weekly panel. */
export function TrendLine({
  values, color, width = 108, height = 30,
}: { values: number[]; color: string; width?: number; height?: number }) {
  const pts = values.filter((v) => Number.isFinite(v));
  if (pts.length < 2) return <div style={{ height }} />;

  const pad = 2;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const xy = pts.map((v, i) => {
    const x = pad + (i / (pts.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={xy.join(" ")} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
