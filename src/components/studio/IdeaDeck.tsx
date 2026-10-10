"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Heart, Maximize2, RotateCcw, X } from "lucide-react";

/**
 * The ideas as a swipe deck: one card per idea, its storyboard image on top.
 * Swipe right (or tap Yes) for "Yes, I'm excited", left (or Nope) for "Not for
 * us". It reads as a carousel: a big "Idea 2 / 5", a progress bar with one
 * segment per idea, and the next cards stacked behind. The first time or two
 * the deck scrolls into view, the card nudges right then left to show the
 * gesture. When every idea has an answer, a summary lets them flip any of them.
 */
export type DeckIdea = { id: string; title: string | null; body: string | null; image: string | null };
type Choice = "like" | "pass" | null;

const THRESHOLD = 100;
const HINT_KEY = "studio:deck-hint";
const HINT_TIMES = 2;
const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

export function IdeaDeck({ ideas, decisions, palette, ready, onNeedName, onDecide, onOpenImage, renderNote }: {
  ideas: DeckIdea[];
  decisions: Record<string, Choice>;
  palette: string[];
  /** false until the client has given their name: answering then asks for it instead */
  ready: boolean;
  onNeedName: () => void;
  onDecide: (id: string, choice: Choice) => void;
  onOpenImage: (index: number) => void;
  renderNote: (id: string) => React.ReactNode;
}) {
  const firstOpen = ideas.findIndex((i) => !decisions[i.id]);
  const [at, setAt] = useState<number>(firstOpen === -1 ? ideas.length : firstOpen);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<"like" | "pass" | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hinting, setHinting] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const yes = ideas.filter((i) => decisions[i.id] === "like").length;
  const cur = ideas[at];

  // Show the gesture: when the deck first comes into view, nudge right (YES) then left (NOPE), twice.
  useEffect(() => {
    const el = box.current;
    if (!el || !cur) return;
    let seen = 0;
    try { seen = Number(localStorage.getItem(HINT_KEY) || 0); } catch { /* private mode */ }
    if (seen >= HINT_TIMES) return;
    let cancelled = false;
    const io = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting || e.intersectionRatio < 0.5) return;
      io.disconnect();
      try { localStorage.setItem(HINT_KEY, String(seen + 1)); } catch { /* private mode */ }
      setHinting(true);
      for (let k = 0; k < 2 && !cancelled; k++) {
        await wait(450); if (cancelled) break; setDx(85);
        await wait(700); if (cancelled) break; setDx(0);
        await wait(350); if (cancelled) break; setDx(-85);
        await wait(700); if (cancelled) break; setDx(0);
      }
      if (!cancelled) setHinting(false);
    }, { threshold: [0.5] });
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); };
    // Once per mount of the deck is enough; the counter in localStorage caps it across visits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function decide(choice: "like" | "pass") {
    if (!cur || leaving) return;
    if (!ready) { setDx(0); onNeedName(); return; }
    setHinting(false);
    setLeaving(choice);
    setDx(choice === "like" ? 700 : -700);
    window.setTimeout(() => {
      onDecide(cur.id, choice);
      setLeaving(null); setDx(0);
      setAt((n) => n + 1);
    }, 280);
  }

  if (!ideas.length) return null;

  const progress = (
    <div className="flex gap-1.5" aria-hidden>
      {ideas.map((i, n) => (
        <span key={i.id} className={`h-1.5 flex-1 rounded-full transition-colors ${decisions[i.id] === "like" ? "bg-[var(--brand)]" : decisions[i.id] === "pass" ? "bg-[var(--text-muted)] opacity-50" : n === at ? "bg-[var(--text)]" : "bg-[var(--surface-hover)]"}`} />
      ))}
    </div>
  );

  if (!cur) {
    return (
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4">
        {progress}
        <div className="rounded-panel border border-[var(--border)] bg-surface p-5">
          <p className="text-[22px] font-bold tracking-tight">You&apos;ve seen all {ideas.length} ideas</p>
          <p className="mt-1 text-[14px] text-text-muted">
            {yes ? `You said yes to ${yes}. Tap any answer to change it, then send it to BCON below.` : "Nothing caught your eye? Tap any idea to change your answer, or tell us what you want under Inputs."}
          </p>
          <ul className="mt-4 flex flex-col">
            {ideas.map((i, n) => {
              const d = decisions[i.id];
              return (
                <li key={i.id} className="flex items-center gap-3 border-t border-[var(--border)] py-3 first:border-t-0">
                  <button onClick={() => onOpenImage(n)} className="h-16 w-[52px] shrink-0 overflow-hidden rounded-soft bg-[var(--bg)]" aria-label={`See ${i.title}`}>
                    {i.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={i.image} alt="" className="h-full w-full object-cover" />
                      : <span className="block h-full w-full" style={{ background: palette[n % Math.max(1, palette.length)] || "var(--surface-hover)" }} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-text-muted">Idea {n + 1}</p>
                    <p className="text-[14.5px] font-medium leading-snug">{i.title}</p>
                  </div>
                  <button onClick={() => onDecide(i.id, d === "like" ? "pass" : "like")}
                    className={`flex h-10 shrink-0 items-center gap-1.5 rounded-pill px-3.5 text-[13px] font-semibold ${d === "like" ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "border border-[var(--border)] text-text-muted"}`}>
                    {d === "like" ? <><Heart size={14} className="fill-current" /> Yes</> : <><X size={14} /> Nope</>}
                  </button>
                </li>
              );
            })}
          </ul>
          <button onClick={() => setAt(0)} className="mt-3 flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text">
            <RotateCcw size={13} /> Go through them again
          </button>
        </div>
      </div>
    );
  }

  const rot = dx / 18;
  const yesGlow = Math.min(1, Math.max(0, dx / THRESHOLD));
  const noGlow = Math.min(1, Math.max(0, -dx / THRESHOLD));
  const behind = ideas.slice(at + 1, at + 3);

  return (
    <div ref={box} className="mx-auto flex w-full max-w-[520px] flex-col gap-3">
      {/* Where they are in the set: big and obvious */}
      <div className="flex items-end justify-between gap-3">
        <p className="leading-none">
          <span className="text-[34px] font-bold tracking-[-0.03em]">Idea {at + 1}</span>
          <span className="ml-1.5 text-[18px] font-medium text-text-muted">/ {ideas.length}</span>
        </p>
        <p className="pb-1 text-[12.5px] text-text-muted">{ideas.length - at - 1 > 0 ? `${ideas.length - at - 1} more after this` : "Last one"}</p>
      </div>
      {progress}

      <div className="relative isolate mb-3 mt-2">
        {/* The next ideas, stacked behind so it reads as a deck */}
        {behind.map((b, k) => (
          <div key={b.id} aria-hidden
            className="absolute inset-0 overflow-hidden rounded-panel border border-[var(--border)] bg-surface"
            style={{ transform: `translateY(${(k + 1) * 10}px) scale(${1 - (k + 1) * 0.04})`, opacity: 0.7 - k * 0.25, zIndex: -1 - k }}>
            {b.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.image} alt="" className="h-full w-full object-cover opacity-40" />
            )}
          </div>
        ))}
        <article
          onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button,textarea,a")) return; start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDragging(true); setHinting(false); }}
          onPointerMove={(e) => { if (start.current && start.current.id === e.pointerId) setDx(e.clientX - start.current.x); }}
          onPointerUp={() => {
            if (!start.current) return;
            start.current = null; setDragging(false);
            if (dx > THRESHOLD) decide("like"); else if (dx < -THRESHOLD) decide("pass"); else setDx(0);
          }}
          onPointerCancel={() => { start.current = null; setDragging(false); setDx(0); }}
          style={{ transform: `translateX(${dx}px) rotate(${rot}deg)`, transition: dragging ? "none" : hinting ? "transform 450ms cubic-bezier(0.34, 1.4, 0.64, 1)" : "transform 280ms ease" }}
          className="relative touch-pan-y select-none overflow-hidden rounded-panel border border-[var(--border)] bg-surface shadow-card">
          <div className="relative">
            {cur.image ? (
              <div className="relative h-[44svh] max-h-[560px] w-full overflow-hidden bg-black sm:h-[520px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cur.image} alt="" aria-hidden draggable={false} className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-xl" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cur.image} alt={cur.title || ""} draggable={false} className="relative h-full w-full object-contain" />
              </div>
            ) : (
              <div className="flex h-[44svh] max-h-[560px] w-full items-end p-5 sm:h-[520px]" style={{ background: `linear-gradient(160deg, ${palette[0] || "#222"}, ${palette[1] || "#444"})` }}>
                <p className="text-[13px] text-white/80">Storyboard coming soon</p>
              </div>
            )}
            {cur.image && (
              <button onClick={() => onOpenImage(at)} aria-label="See it full screen"
                className="absolute right-3 top-3 flex h-10 items-center gap-1.5 rounded-full bg-black/65 px-3 text-[12.5px] text-white hover:bg-black/80">
                <Maximize2 size={14} /> Full screen
              </button>
            )}
            <span style={{ opacity: yesGlow }} className="pointer-events-none absolute left-4 top-5 -rotate-12 rounded-soft border-4 border-[var(--brand)] bg-black/30 px-3 py-1 text-[26px] font-black uppercase tracking-wide text-[var(--brand)]">Yes!</span>
            <span style={{ opacity: noGlow }} className="pointer-events-none absolute right-4 top-14 rotate-12 rounded-soft border-4 border-white bg-black/30 px-3 py-1 text-[26px] font-black uppercase tracking-wide text-white">Nope</span>
          </div>
          <div className="flex flex-col gap-1.5 p-4">
            <h4 className="text-[21px] font-semibold leading-snug tracking-tight">{cur.title}</h4>
            {cur.body && <p className="line-clamp-3 text-[14.5px] leading-relaxed text-text-muted">{cur.body}</p>}
            <div>{renderNote(cur.id)}</div>
          </div>
        </article>
      </div>

      {/* The two answers, big, each showing its swipe direction */}
      <div className="mt-2 grid grid-cols-[1fr_1.4fr] gap-3">
        <button onClick={() => decide("pass")} aria-label="Not for us"
          className="flex h-16 items-center justify-center gap-2 rounded-panel border-2 border-[var(--border)] bg-surface text-[16px] font-bold text-text transition-transform hover:border-[var(--text-muted)] active:scale-95">
          <ArrowLeft size={18} className="text-text-muted" /> <X size={20} /> Nope
        </button>
        <button onClick={() => decide("like")} aria-label="Yes, I'm excited"
          className="flex h-16 items-center justify-center gap-2 rounded-panel bg-[var(--brand)] text-[16px] font-bold text-[var(--brand-ink)] shadow-[0_0_24px_var(--brand-soft)] transition-transform active:scale-95">
          <Heart size={20} className="fill-current" /> Yes, I&apos;m excited <ArrowRight size={18} />
        </button>
      </div>
      <p className="text-center text-[12.5px] text-text-muted">
        Swipe the card: <span className="text-text">left for nope</span>, <span className="text-text">right for yes</span>.
        {at > 0 && <> <button onClick={() => setAt((n) => Math.max(0, n - 1))} className="underline underline-offset-2 hover:text-text">Back to idea {at}</button></>}
      </p>
    </div>
  );
}
