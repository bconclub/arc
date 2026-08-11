"use client";

import { Search, X } from "lucide-react";

/**
 * Filter row: active count, a set of dropdowns, and free-text search.
 *
 * The active count and the Clear control are not decoration. A filtered list
 * that looks empty is indistinguishable from a list that IS empty, and that
 * ambiguity on a money screen reads as missing data. The count states how many
 * filters are narrowing the view, and Clear undoes them in one action.
 */

export type SelectFilter = {
  key: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
};

/** Filters use "" for "no filter", so any non-empty value is active. */
export function countActive(filters: SelectFilter[], search?: string): number {
  return filters.filter((f) => f.value !== "").length + (search?.trim() ? 1 : 0);
}

const controlCls =
  "h-8 rounded-pill border border-[var(--border)] bg-surface px-3 text-[12px] text-text transition-colors hover:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-line)]";

export function FilterBar({
  filters, search, onSearchChange, searchPlaceholder = "Search…", onClear, className = "",
}: {
  filters: SelectFilter[];
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  onClear: () => void;
  className?: string;
}) {
  const active = countActive(filters, search);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
        Filters
        {active > 0 && (
          <span className="rounded-pill bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--brand-text)]">
            {active}
          </span>
        )}
      </span>

      {filters.map((f) => (
        <select
          key={f.key}
          value={f.value}
          aria-label={f.label}
          onChange={(e) => f.onChange(e.target.value)}
          className={`${controlCls} ${f.value ? "border-[var(--brand-line)]" : ""}`}
        >
          <option value="">{f.label}</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ))}

      {onSearchChange && (
        <label className="relative flex items-center">
          <Search size={13} className="pointer-events-none absolute left-3 text-text-muted" />
          <input
            value={search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={`${controlCls} w-44 pl-8`}
          />
        </label>
      )}

      {active > 0 && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 rounded-pill px-2 py-1 text-[11.5px] text-text-muted transition-colors hover:text-text"
        >
          <X size={12} /> Clear
        </button>
      )}
    </div>
  );
}
