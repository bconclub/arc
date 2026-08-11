"use client";

import { useState } from "react";
import { initials, avatarColor } from "@/lib/format";

/**
 * Resolves a brand's icon from its own website when no logo is stored.
 *
 * Only 2 of the 7 client domains currently return a real favicon — the rest
 * answer 404 with Google's generic grey globe, which reads worse than initials.
 * So the <img> is allowed to fail and `onError` swaps in the initials tile;
 * we never render a placeholder globe.
 */
export function brandIconUrl(logoUrl: string | null, domains: string[] | null): string | null {
  if (logoUrl) return logoUrl;
  const raw = domains?.find((d) => d && d.trim());
  if (!raw) return null;
  const host = raw.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!host) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}

export function BrandMark({
  name, logoUrl, domains, color, size = 32, radius = "rounded-lg",
}: {
  name: string;
  logoUrl?: string | null;
  domains?: string[] | null;
  color?: string | null;
  size?: number;
  radius?: string;
}) {
  const src = brandIconUrl(logoUrl ?? null, domains ?? null);
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      // Plain <img>: these are third-party favicons on arbitrary hosts, so the
      // Next image optimiser adds no value and would need remotePatterns entries.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={`${radius} shrink-0 bg-[var(--surface-hover)] object-contain`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={`${radius} flex shrink-0 items-center justify-center font-bold text-white`}
      style={{
        width: size,
        height: size,
        background: color ?? avatarColor(name),
        fontSize: Math.max(8, Math.round(size * 0.34)),
      }}
    >
      {initials(name)}
    </span>
  );
}
