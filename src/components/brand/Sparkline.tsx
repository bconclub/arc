"use client";

// Minimal inline-SVG sparkline. No chart lib — strokes use ARC CSS vars.
export function Sparkline({ values, width = 220, height = 48 }: { values: number[]; width?: number; height?: number }) {
  const pts = values.filter((v) => Number.isFinite(v));
  if (pts.length < 2) {
    return <div className="flex h-12 items-center text-[11px] text-text-muted">need 2+ entries to chart</div>;
  }
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const pad = 4;
  const coords = pts.map((v, i) => {
    const x = pad + (i / (pts.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="max-w-full">
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke="var(--text)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coords.length > 0 && (
        <circle
          cx={coords[coords.length - 1].split(",")[0]}
          cy={coords[coords.length - 1].split(",")[1]}
          r="2.5"
          fill="var(--text)"
        />
      )}
    </svg>
  );
}
