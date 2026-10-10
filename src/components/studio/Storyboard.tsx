"use client";

import { Maximize2 } from "lucide-react";

/**
 * An idea's scenes laid out as one storyboard: vertical frames side by side in
 * a single framed sheet, numbered in the order the reel plays, each with its
 * scene line underneath. Reads as one image of the reel, not a loose collage.
 * Up to 3 scenes fill the width on a phone; more scroll sideways so no frame
 * gets too small. Tapping any scene opens the viewer on it.
 */
export type Scene = { id: string; url: string | null; title: string | null };

export function Storyboard({ scenes, onOpen, label = "Storyboard" }: { scenes: Scene[]; onOpen: (index: number) => void; label?: string }) {
  if (!scenes.length) return null;
  const shown = scenes.slice(0, 6);
  const many = shown.length > 3;
  return (
    <figure className="overflow-hidden rounded-panel border border-[var(--border)] bg-black">
      <div className="flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-white/55">
        <span>{label} · {shown.length} scene{shown.length === 1 ? "" : "s"}{many ? <span className="normal-case tracking-normal sm:hidden"> · swipe</span> : null}</span>
        <button onClick={() => onOpen(0)} className="flex items-center gap-1 normal-case tracking-normal text-white/70 hover:text-white">
          <Maximize2 size={12} /> View
        </button>
      </div>
      <div className={`flex gap-[3px] px-[3px] pb-2.5 ${many ? "snap-x snap-mandatory overflow-x-auto sm:overflow-visible" : ""}`}>
        {shown.map((s, i) => (
          <div key={s.id} className={`flex min-w-0 snap-start flex-col gap-2 ${many ? "w-[31%] shrink-0 sm:w-auto sm:flex-1 sm:shrink" : "flex-1"}`}>
            <button onClick={() => onOpen(i)} aria-label={`Open scene ${i + 1}${s.title ? `: ${s.title}` : ""}`}
              className="relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url || ""} alt={s.title || `Scene ${i + 1}`} loading="lazy"
                className="aspect-[9/16] w-full object-cover transition-transform duration-300 hover:scale-[1.03]" />
              <span className="absolute left-1.5 top-1.5 rounded-[4px] bg-black/70 px-1.5 py-0.5 font-mono text-[10.5px] text-white">{String(i + 1).padStart(2, "0")}</span>
            </button>
            <span className="line-clamp-2 px-1 text-[11px] leading-snug text-white/65" title={s.title || ""}>{s.title || `Scene ${i + 1}`}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
