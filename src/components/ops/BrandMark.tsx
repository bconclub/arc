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

/** What sits behind the logo so it stays visible. */
type Backdrop = "none" | "dark" | "light" | "neutral";

const BACKDROP_CLS: Record<Backdrop, string> = {
  // The logo carries its own background, so anything added would box it in.
  none: "bg-transparent",
  dark: "bg-[#141414]",
  light: "bg-white",
  neutral: "bg-[var(--surface-hover)]",
};

/**
 * Picks a backdrop from the artwork itself rather than from the theme.
 *
 * A white-on-transparent mark disappears on a white card, and a black-on-
 * transparent mark disappears on a dark one. Choosing by theme fixes one of
 * those and breaks the other, so the decision is made from the logo's own ink:
 * light ink gets a dark tile, dark ink gets a light tile, whatever the theme.
 *
 * Returns "none" when the image is essentially opaque, since it then supplies
 * its own background and needs no help.
 */
function measureBackdrop(img: HTMLImageElement): Backdrop {
  const S = 24;   // downsampling to 24px is plenty and keeps this cheap
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "neutral";
  ctx.drawImage(img, 0, 0, S, S);

  // Reading pixels from a cross-origin image throws unless the host sent CORS
  // headers. Falling back to a neutral tile is correct, not a failure.
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, S, S).data;
  } catch {
    return "neutral";
  }

  let transparent = 0;
  let inkSum = 0;
  let inkCount = 0;
  const total = S * S;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 250) transparent += 1;
    if (a < 16) continue;   // fully clear pixels carry no colour information
    // Rec. 709 luminance, 0..1
    inkSum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    inkCount += 1;
  }

  if (inkCount === 0) return "neutral";
  if (transparent / total < 0.05) return "none";

  const lum = inkSum / inkCount;
  if (lum > 0.62) return "dark";    // pale ink needs something dark behind it
  if (lum < 0.42) return "light";   // dark ink needs something pale
  return "neutral";                 // mid-tone or multicoloured: leave it alone
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
  // Neutral until measured, so a transparent logo is never briefly invisible.
  const [backdrop, setBackdrop] = useState<Backdrop>("neutral");

  if (src && !failed) {
    return (
      // Plain <img>: these are third-party logos on arbitrary hosts, so the
      // Next image optimiser adds no value and would need remotePatterns entries.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        // Needed to read pixels back; hosts that refuse it just fall through to
        // the neutral tile via the try/catch in measureBackdrop.
        crossOrigin="anonymous"
        onLoad={(e) => setBackdrop(measureBackdrop(e.currentTarget))}
        onError={() => setFailed(true)}
        className={`${radius} ${BACKDROP_CLS[backdrop]} shrink-0 object-contain p-[2px] ring-1 ring-[var(--border)]`}
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
