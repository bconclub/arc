"use client";

import { useState } from "react";
import { initials, avatarColor } from "@/lib/format";

/**
 * Only ever renders a logo that was explicitly resolved and stored.
 *
 * Guessing a favicon at render time doesn't work: Google answers 200 with a
 * generic grey globe for sites that have none, so `onError` never fires and the
 * card shows a placeholder that looks worse than initials. Resolution now
 * happens server-side in /api/ops/brands/logo, which can measure the response
 * and reject the globe, and the winner is saved to brands.logo_url.
 */
export function brandIconUrl(logoUrl: string | null): string | null {
  return logoUrl && logoUrl.trim() ? logoUrl.trim() : null;
}

export function BrandMark({
  name, logoUrl, color, size = 32, radius = "rounded-lg",
}: {
  name: string;
  logoUrl?: string | null;
  color?: string | null;
  size?: number;
  radius?: string;
}) {
  const src = brandIconUrl(logoUrl ?? null);
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
