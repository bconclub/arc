"use client";

/**
 * The order's four steps as one track with a beam of light. Each step sits in
 * its own column (dot over label, so they always line up). The track is lit up
 * to the current step and half way on toward the next, so the light is always
 * visibly heading somewhere; a soft beam keeps sweeping along the lit part and
 * the current dot pulses. "compact" is the header version; the full one adds a
 * line on what each step means and "You are here".
 */
export type Step = { key: string; n: string; label: string; detail?: string };

export function StepTimeline({ steps, current, compact = false }: { steps: readonly Step[]; current: number; compact?: boolean }) {
  const n = steps.length, last = n - 1;
  const lit = last > 0 ? Math.min(1, (Math.max(0, current) + (current < last ? 0.5 : 0)) / last) : 1;
  const inset = `${50 / n}%`; // the track runs from the first column's centre to the last's
  return (
    <div className={compact ? "" : "py-2"}>
      <div className="relative">
        <div className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[var(--surface-hover)]" style={{ left: inset, right: inset }} />
        <div className="absolute top-1/2 h-[3px] -translate-y-1/2" style={{ left: inset, right: inset }}>
          <div className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[var(--brand)] via-[var(--brand)] to-transparent shadow-[0_0_14px_var(--brand)] transition-[width] duration-700"
            style={{ width: `${lit * 100}%` }}>
            <span className="beam-sweep absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white to-transparent" />
          </div>
        </div>
        <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {steps.map((s, i) => {
            const done = i < current, now = i === current;
            return (
              <li key={s.key} className="flex h-6 items-center justify-center">
                <span className="relative flex h-6 w-6 items-center justify-center">
                  {now && <span className="beam-pulse absolute h-6 w-6 rounded-full bg-[var(--brand)]" />}
                  <span className={`relative rounded-full transition-all ${now ? "h-4 w-4 bg-[var(--brand)] shadow-[0_0_16px_var(--brand)]" : done ? "h-2.5 w-2.5 bg-[var(--brand)]" : "h-2.5 w-2.5 border border-[var(--border)] bg-[var(--bg)]"}`} />
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <ol className="mt-3 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => (
          <li key={s.key} className="min-w-0 px-1 text-center">
            <p className={`text-[12px] leading-tight sm:text-[13px] ${i <= current ? "text-text" : "text-text-muted"} ${i === current ? "font-semibold" : ""}`}>
              <span className="block font-mono text-[10.5px] text-text-muted sm:inline sm:mr-1">{s.n}</span>{s.label}
            </p>
            {!compact && s.detail && <p className="mt-1 hidden text-[11.5px] leading-snug text-text-muted sm:block">{s.detail}</p>}
            {!compact && i === current && <p className="mt-1 text-[11px] font-medium text-[var(--brand-text)]">You are here</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
