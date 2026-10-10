"use client";

import { useRef, useState } from "react";
import { Heart, Maximize2, RotateCcw, X } from "lucide-react";

/**
 * The ideas as a swipe deck: one card per idea, its storyboard image on top.
 * Swipe right (or tap the heart) for "Yes, I'm excited", left (or the X) for
 * "Not for us". The next card waits behind. When every idea has an answer, a
 * summary shows them all and any answer can be flipped.
 */
export type DeckIdea = { id: string; title: string | null; body: string | null; image: string | null };
type Choice = "like" | "pass" | null;

const THRESHOLD = 100;

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
  const start = useRef<{ x: number; y: number; id: number } | null>(null);

  const yes = ideas.filter((i) => decisions[i.id] === "like").length;
  const cur = ideas[at];
  const next = ideas[at + 1];

  function decide(choice: "like" | "pass") {
    if (!cur || leaving) return;
    if (!ready) { setDx(0); onNeedName(); return; }
    setLeaving(choice);
    setDx(choice === "like" ? 700 : -700);
    window.setTimeout(() => {
      onDecide(cur.id, choice);
      setLeaving(null); setDx(0);
      setAt((n) => n + 1);
    }, 260);
  }

  if (!ideas.length) return null;

  if (!cur) {
    return (
      <div className="rounded-panel border border-[var(--border)] bg-surface p-5">
        <p className="text-[20px] font-semibold tracking-tight">You&apos;ve seen all {ideas.length} ideas</p>
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
                <p className="min-w-0 flex-1 text-[14.5px] font-medium leading-snug">{i.title}</p>
                <button onClick={() => onDecide(i.id, d === "like" ? "pass" : "like")}
                  className={`flex h-9 shrink-0 items-center gap-1.5 rounded-pill px-3 text-[12.5px] font-semibold ${d === "like" ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "border border-[var(--border)] text-text-muted"}`}>
                  {d === "like" ? <><Heart size={14} className="fill-current" /> Yes</> : <><X size={14} /> No</>}
                </button>
              </li>
            );
          })}
        </ul>
        <button onClick={() => setAt(0)} className="mt-3 flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text">
          <RotateCcw size={13} /> Go through them again
        </button>
      </div>
    );
  }

  const rot = dx / 18;
  const yesGlow = Math.min(1, Math.max(0, dx / THRESHOLD));
  const noGlow = Math.min(1, Math.max(0, -dx / THRESHOLD));

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4">
      <div className="flex items-center justify-between text-[12.5px] text-text-muted">
        <span>Idea {at + 1} of {ideas.length}</span>
        <span className="flex gap-1">
          {ideas.map((i, n) => (
            <span key={i.id} className={`h-1.5 w-5 rounded-full ${decisions[i.id] === "like" ? "bg-[var(--brand)]" : decisions[i.id] === "pass" ? "bg-[var(--border)]" : n === at ? "bg-text" : "bg-[var(--surface-hover)]"}`} />
          ))}
        </span>
      </div>

      <div className="relative">
        {next && (
          <div aria-hidden className="absolute inset-0 translate-y-3 scale-[0.95] overflow-hidden rounded-panel border border-[var(--border)] bg-surface opacity-60" />
        )}
        <article
          onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button,textarea,a")) return; start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDragging(true); }}
          onPointerMove={(e) => { if (start.current && start.current.id === e.pointerId) setDx(e.clientX - start.current.x); }}
          onPointerUp={() => {
            if (!start.current) return;
            start.current = null; setDragging(false);
            if (dx > THRESHOLD) decide("like"); else if (dx < -THRESHOLD) decide("pass"); else setDx(0);
          }}
          onPointerCancel={() => { start.current = null; setDragging(false); setDx(0); }}
          style={{ transform: `translateX(${dx}px) rotate(${rot}deg)`, transition: dragging ? "none" : "transform 260ms ease" }}
          className="relative touch-pan-y select-none overflow-hidden rounded-panel border border-[var(--border)] bg-surface shadow-card">
          <div className="relative">
            {cur.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cur.image} alt={cur.title || ""} draggable={false} className="h-[44svh] max-h-[560px] w-full bg-black object-cover sm:h-[520px]" />
            ) : (
              <div className="flex h-[44svh] max-h-[560px] w-full items-end p-5 sm:h-[520px]" style={{ background: `linear-gradient(160deg, ${palette[0] || "#222"}, ${palette[1] || "#444"})` }}>
                <p className="text-[13px] text-white/80">Storyboard coming soon</p>
              </div>
            )}
            {cur.image && (
              <button onClick={() => onOpenImage(at)} aria-label="See it full screen"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
                <Maximize2 size={15} />
              </button>
            )}
            <span style={{ opacity: yesGlow }} className="pointer-events-none absolute left-4 top-5 -rotate-12 rounded-soft border-4 border-[var(--brand)] px-3 py-1 text-[22px] font-black uppercase tracking-wide text-[var(--brand)]">Yes!</span>
            <span style={{ opacity: noGlow }} className="pointer-events-none absolute right-4 top-5 rotate-12 rounded-soft border-4 border-white/80 px-3 py-1 text-[22px] font-black uppercase tracking-wide text-white/90">Nope</span>
          </div>
          <div className="flex flex-col gap-1.5 p-4">
            <h4 className="text-[21px] font-semibold leading-snug tracking-tight">{cur.title}</h4>
            {cur.body && <p className="line-clamp-3 text-[14.5px] leading-relaxed text-text-muted">{cur.body}</p>}
            <div>{renderNote(cur.id)}</div>
          </div>
        </article>
      </div>

      <div className="flex items-center justify-center gap-5">
        <button onClick={() => decide("pass")} aria-label="Not for us"
          className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--border)] bg-surface text-text-muted shadow-card transition-transform hover:scale-105 active:scale-95">
          <X size={28} />
        </button>
        <button onClick={() => decide("like")} aria-label="Yes, I'm excited"
          className="flex h-16 items-center gap-2 rounded-full bg-[var(--brand)] px-6 text-[15.5px] font-bold text-[var(--brand-ink)] shadow-card transition-transform hover:scale-105 active:scale-95">
          <Heart size={22} className="fill-current" /> Yes, I&apos;m excited
        </button>
      </div>
      <p className="text-center text-[12px] text-text-muted">Swipe right for yes, left for not for us. {at > 0 && <button onClick={() => setAt((n) => Math.max(0, n - 1))} className="underline-offset-2 hover:underline">Back</button>}</p>
    </div>
  );
}
