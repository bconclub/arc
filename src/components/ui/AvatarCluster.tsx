"use client";

import { BrandMark } from "@/components/ops/BrandMark";

/**
 * Overlapping avatars, capped with a "+N".
 *
 * Wraps BrandMark rather than reimplementing avatars, so the logo-or-initials
 * fallback and the stored-logo rule stay in one place.
 */
export function AvatarCluster({
  items, size = 24, max = 4, className = "",
}: {
  items: { id: string; name: string; logoUrl?: string | null; color?: string | null }[];
  size?: number;
  max?: number;
  className?: string;
}) {
  if (items.length === 0) return null;
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;

  return (
    <div className={`flex items-center ${className}`}>
      {shown.map((it, i) => (
        <span
          key={it.id}
          title={it.name}
          className="rounded-pill ring-2 ring-[var(--surface)]"
          style={{ marginLeft: i === 0 ? 0 : -size / 3, zIndex: shown.length - i }}
        >
          <BrandMark name={it.name} logoUrl={it.logoUrl ?? null} color={it.color} size={size} radius="rounded-pill" />
        </span>
      ))}
      {rest > 0 && (
        <span
          className="flex items-center justify-center rounded-pill bg-[var(--surface-hover)] font-semibold text-text-muted ring-2 ring-[var(--surface)]"
          style={{ width: size, height: size, marginLeft: -size / 3, fontSize: Math.max(8, size * 0.36) }}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
