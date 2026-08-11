"use client";

import { ChevronLeft } from "lucide-react";

/**
 * Two-pane list/detail layout.
 *
 * On desktop the panes sit side by side. On mobile they do NOT, squeezing a
 * detail panel next to a list at 375px gives two unusable columns and a
 * horizontal scrollbar. Instead the detail takes the full width and the list is
 * hidden behind a back control, which is how the pattern is expected to behave
 * on a phone.
 */
export function MasterDetail({
  list, detail, hasSelection, onBack, backLabel = "All items", listWidth = "380px",
}: {
  list: React.ReactNode;
  detail: React.ReactNode;
  /** Drives which pane is visible on mobile. */
  hasSelection: boolean;
  onBack: () => void;
  backLabel?: string;
  listWidth?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <div
        // Width applies from `lg` only. As an inline style it would override the
        // mobile `flex-1` and pin the list to 380px on a phone.
        className={`min-h-0 min-w-0 flex-col lg:flex lg:shrink-0 lg:grow-0 lg:basis-[var(--list-w)] ${
          hasSelection ? "hidden" : "flex flex-1"
        }`}
        style={{ "--list-w": listWidth } as React.CSSProperties}
      >
        {list}
      </div>

      <div className={`min-h-0 min-w-0 flex-1 flex-col lg:flex ${hasSelection ? "flex" : "hidden"}`}>
        {hasSelection && (
          <button
            onClick={onBack}
            className="mb-2 flex items-center gap-1 self-start rounded-pill px-2 py-1 text-[12px] text-text-muted hover:text-text lg:hidden"
          >
            <ChevronLeft size={14} /> {backLabel}
          </button>
        )}
        {detail}
      </div>
    </div>
  );
}
