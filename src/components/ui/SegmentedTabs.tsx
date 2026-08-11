"use client";

/**
 * Pill tab row with a lime active state — the control the reference screens use
 * for "All Invoices / Draft 3 / Unpaid 5" and for the section switcher.
 *
 * Counts are part of the tab rather than a separate badge because the count is
 * what makes the tab worth reading: "Unpaid 5" is a status report, "Unpaid" is
 * a filter name.
 */

export type Tab<T extends string = string> = {
  value: T;
  label: string;
  /** Omitted rather than zero when a count doesn't apply — 0 is meaningful. */
  count?: number;
};

export function SegmentedTabs<T extends string>({
  tabs, value, onChange, size = "md", className = "", ariaLabel,
}: {
  tabs: Tab<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}) {
  const pad = size === "sm" ? "px-2.5 py-1 text-[11.5px]" : "px-3.5 py-1.5 text-[12.5px]";

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      // Scrolls rather than wraps: on a narrow screen a wrapping tab row pushes
      // the content below it off the fold.
      className={`scrollbar-hide flex shrink-0 items-center gap-1 overflow-x-auto rounded-pill bg-[var(--surface-hover)] p-1 ${className}`}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={`flex shrink-0 items-center gap-1.5 rounded-pill font-medium transition-colors duration-150 ${pad} ${
              active
                ? "bg-[var(--brand)] text-[var(--brand-ink)]"
                : "text-text-muted hover:text-text"
            }`}
          >
            {t.label}
            {t.count != null && (
              <span
                className={`tabular-nums ${
                  active ? "opacity-70" : "rounded-pill bg-[var(--glow-white)] px-1.5 text-[10px]"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
