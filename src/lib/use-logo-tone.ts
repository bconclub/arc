"use client";

import { useEffect, useState } from "react";

/**
 * Picks the tile behind a brand logo. Logos arrive in every form: dark marks on
 * white JPGs, white marks on transparent PNGs. A white tile makes the second kind
 * vanish and a dark tile swallows the first, so we read the logo's own pixels and
 * choose: "dark" tile for a light logo, "light" tile otherwise.
 */
export function useLogoTone(url: string | null | undefined): "light" | "dark" {
  const [tone, setTone] = useState<"light" | "dark">("light");
  useEffect(() => {
    if (!url) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        const w = (c.width = 48), h = (c.height = 48);
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const d = ctx.getImageData(0, 0, w, h).data;
        let sum = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3] / 255;
          if (a < 0.2) continue; // transparent background says nothing about the mark
          sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
          n++;
        }
        // Mostly-light visible pixels on a transparent canvas = a light logo.
        const transparentShare = 1 - n / (w * h);
        setTone(n && sum / n > 0.7 && transparentShare > 0.15 ? "dark" : "light");
      } catch {
        /* tainted canvas (no CORS): keep the white tile */
      }
    };
    img.src = url;
  }, [url]);
  return tone;
}

export const logoTile = (tone: "light" | "dark") => (tone === "dark" ? "bg-[#111] ring-1 ring-white/10" : "bg-white");
