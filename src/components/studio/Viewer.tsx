"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useBackToClose } from "./useBackToClose";

/**
 * Full-screen image viewer for the client page. Opens on one image of a set
 * (an idea's scenes, the visual board), then: swipe or arrow keys to move,
 * Escape, the phone's Back gesture, swipe down, the X or the Close button closes it. Shows "2 / 5", the scene's caption, and a
 * thumbnail strip to jump around.
 */
export type ViewerImage = { id: string; url: string | null; title?: string | null; caption?: string | null };

export function Viewer({ images, start, label, onClose, onSeen }: {
  images: ViewerImage[]; start: number; label?: string; onClose: () => void; onSeen?: (img: ViewerImage) => void;
}) {
  const [i, setI] = useState(Math.min(Math.max(start, 0), images.length - 1));
  const touch = useRef<{ x: number; y: number } | null>(null);
  const n = images.length;
  const go = useCallback((d: number) => setI((x) => (x + d + n) % n), [n]);
  const cur = images[i];
  useBackToClose(onClose);

  useEffect(() => { if (cur) onSeen?.(cur); }, [cur, onSeen]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", k);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = overflow; };
  }, [go, onClose]);
  // Preload the neighbours so swiping never waits.
  useEffect(() => {
    for (const d of [1, -1]) { const u = images[(i + d + n) % n]?.url; if (u) { const im = new Image(); im.src = u; } }
  }, [i, images, n]);

  if (!cur) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={label || "Image viewer"} onClick={onClose}
      onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        const t = touch.current; touch.current = null;
        if (!t) return;
        const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose(); // swipe down closes
      }}
      className="fixed inset-0 z-[60] flex flex-col bg-[#060606] text-white">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <p className="min-w-0 truncate text-[13px] text-white/70">
          {label && <span className="text-white">{label} · </span>}{n > 1 ? `${i + 1} / ${n}` : ""}
        </p>
        <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"><X size={18} /></button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={cur.id} src={cur.url || ""} alt={cur.title || ""} onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full animate-fade-in rounded-soft object-contain shadow-2xl" />
        {n > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous"
              className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:flex"><ChevronLeft size={22} /></button>
            <button onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next"
              className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:flex"><ChevronRight size={22} /></button>
          </>
        )}
      </div>

      <div className="shrink-0 px-4 pb-4 pt-3" onClick={(e) => e.stopPropagation()}>
        {(cur.title || cur.caption) && (
          <div className="mx-auto mb-3 max-w-[640px] text-center">
            {cur.title && <p className="text-[15px] font-semibold">{cur.title}</p>}
            {cur.caption && <p className="mt-0.5 text-[13px] leading-relaxed text-white/70">{cur.caption}</p>}
          </div>
        )}
        {n > 1 && (
          <div className="mb-3 flex items-center justify-center gap-3">
            <button onClick={() => go(-1)} aria-label="Previous" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 sm:hidden"><ChevronLeft size={18} /></button>
            <div className="flex max-w-full gap-1.5 overflow-x-auto">
              {images.map((im, j) => (
                <button key={im.id} onClick={() => setI(j)} aria-label={`Image ${j + 1}`} aria-current={j === i}
                  className={`shrink-0 overflow-hidden rounded-[6px] border-2 transition-opacity ${j === i ? "border-white opacity-100" : "border-transparent opacity-50 hover:opacity-80"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.url || ""} alt="" className="h-14 w-8 object-cover sm:h-16 sm:w-9" />
                </button>
              ))}
            </div>
            <button onClick={() => go(1)} aria-label="Next" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 sm:hidden"><ChevronRight size={18} /></button>
          </div>
        )}
        <button onClick={onClose} className="mx-auto flex h-11 items-center gap-2 rounded-full bg-white px-6 text-[14px] font-semibold text-black">
          <X size={16} /> Close
        </button>
      </div>
    </div>
  );
}
