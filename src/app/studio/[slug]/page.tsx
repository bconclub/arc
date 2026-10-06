"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Heart, Loader2, MessageSquare, X } from "lucide-react";

/**
 * A client's view of one brand board, opened from a share link. No ARC login.
 * They see the mood, palette, ideas and images we chose to show, and pick what
 * they like. Every pick saves straight away and lands on the board in ARC.
 */

type Item = { id: string; kind: "idea" | "image"; title: string | null; body: string | null; url: string | null; featured: boolean };
type Pick = { item_id: string; choice: "like" | "pass" | null; comment: string | null };
type Board = { brand: { name: string; mood: string | null; palette: string[]; intro: string | null; logo_url: string | null }; items: Item[]; mine: Pick[] };

const NAME_KEY = "studio:voter";

export default function SharedBoard({ params, searchParams }: { params: { slug: string }; searchParams: { k?: string } }) {
  const key = searchParams.k || "";
  const [board, setBoard] = useState<Board | null>(null);
  const [gone, setGone] = useState(false);
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Item | null>(null);
  const [nudge, setNudge] = useState(false);

  useEffect(() => {
    try { const n = localStorage.getItem(NAME_KEY); if (n) { setName(n); setNameDraft(n); } } catch { /* private mode */ }
  }, []);

  const load = useCallback(async (who: string) => {
    const r = await fetch(`/api/public/studio/${params.slug}?k=${encodeURIComponent(key)}&voter=${encodeURIComponent(who)}`, { cache: "no-store" });
    if (!r.ok) return setGone(true);
    const b: Board = await r.json();
    setBoard(b);
    setPicks(Object.fromEntries(b.mine.map((p) => [p.item_id, p])));
  }, [params.slug, key]);
  useEffect(() => { load(name); }, [load, name]);

  function saveName(e: React.FormEvent) {
    e.preventDefault();
    const n = nameDraft.replace(/\s+/g, " ").trim();
    if (!n) return;
    try { localStorage.setItem(NAME_KEY, n); } catch { /* private mode */ }
    setName(n); setNudge(false);
  }

  async function pick(item: Item, patch: Partial<Pick>) {
    if (!name) { setNudge(true); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const prev = picks[item.id] || { item_id: item.id, choice: null, comment: null };
    const next = { ...prev, ...patch };
    setPicks((p) => ({ ...p, [item.id]: next }));
    setSaving(item.id); setErr(null);
    const r = await fetch(`/api/public/studio/${params.slug}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ k: key, item_id: item.id, voter: name, choice: next.choice, ...(patch.comment !== undefined ? { comment: patch.comment } : {}) }),
    });
    setSaving(null);
    if (!r.ok) { setPicks((p) => ({ ...p, [item.id]: prev })); setErr("That pick did not save. Check your connection and try again."); }
  }

  if (gone) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-6 text-center">
        <div>
          <p className="text-[15px] text-text">This board is not available.</p>
          <p className="mt-1 text-[13px] text-text-muted">The link may have changed. Ask the BCON team for a fresh one.</p>
        </div>
      </main>
    );
  }
  if (!board) return <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-text-muted"><Loader2 className="animate-spin" size={20} /></main>;

  const { brand, items } = board;
  const ideas = items.filter((i) => i.kind === "idea");
  const images = items.filter((i) => i.kind === "image");
  const liked = Object.values(picks).filter((p) => p.choice === "like").length;

  return (
    <main className="min-h-screen bg-[var(--bg)] pb-28 text-text">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-4 lg:px-8">
        <div className="flex items-center gap-3">
          {brand.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logo_url} alt="" className="h-10 w-10 rounded-soft bg-white object-contain" />
          )}
          <span className="text-[15px] font-semibold">{brand.name}</span>
        </div>
        <span className="text-[12px] text-text-muted">Prepared by BCON</span>
      </header>

      <section className="mx-auto max-w-[1200px] px-4 pb-10 pt-8 lg:px-8 lg:pt-14">
        <h1 className="max-w-[18ch] text-[40px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[56px]">Ideas for {brand.name}</h1>
        <p className="mt-4 max-w-[60ch] text-[16px] leading-relaxed text-text-muted">
          {brand.intro || "Here is where we want to take your content. Tap what you love, pass on what is not you, and leave a note on anything. Your picks reach us as you go."}
        </p>
        {(brand.mood || brand.palette.length > 0) && (
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-stretch">
            {brand.mood && (
              <div className="flex-1 rounded-panel border border-[var(--border)] bg-surface p-5">
                <p className="text-[12px] font-medium text-text-muted">The mood</p>
                <p className="mt-1 text-[18px] leading-snug">{brand.mood}</p>
              </div>
            )}
            {brand.palette.length > 0 && (
              <div className="flex min-h-[96px] overflow-hidden rounded-panel border border-[var(--border)] sm:w-[320px]">
                {brand.palette.map((c) => <div key={c} className="flex-1" style={{ background: c }} title={c} />)}
              </div>
            )}
          </div>
        )}

        <form onSubmit={saveName}
          className={`mt-8 flex flex-wrap items-center gap-2 rounded-panel border p-4 transition-colors ${nudge ? "border-[var(--brand)] bg-[var(--brand-faint)]" : "border-[var(--border)] bg-surface"}`}>
          {name ? (
            <p className="text-[14px]">Picking as <span className="font-semibold">{name}</span>.{" "}
              <button type="button" onClick={() => setName("")} className="text-text-muted underline-offset-2 hover:text-text hover:underline">Not you?</button>
            </p>
          ) : (
            <>
              <label htmlFor="voter" className="w-full text-[14px] sm:w-auto">{nudge ? "Add your name first, so we know whose picks these are:" : "Your name, so we know whose picks these are:"}</label>
              <input id="voter" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoComplete="name" placeholder="e.g. Priya"
                className="h-11 w-full rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 text-[15px] outline-none focus:border-[var(--brand-line)] sm:w-60" />
              <button className="h-11 rounded-soft bg-[var(--brand)] px-5 text-[14px] font-semibold text-[var(--brand-ink)]">Start picking</button>
            </>
          )}
        </form>
      </section>

      {ideas.length > 0 && (
        <section className="mx-auto max-w-[1200px] px-4 pb-14 lg:px-8">
          <h2 className="mb-4 text-[22px] font-semibold tracking-tight">Ideas</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {ideas.map((i) => {
              const p = picks[i.id];
              return (
                <article key={i.id} className={`flex flex-col gap-3 rounded-panel border p-5 transition-colors ${p?.choice === "like" ? "border-[var(--brand-line)] bg-[var(--brand-faint)]" : "border-[var(--border)] bg-surface"}`}>
                  <h3 className="text-[18px] font-semibold leading-snug">{i.title}</h3>
                  {i.body && <p className="text-[15px] leading-relaxed text-text-muted">{i.body}</p>}
                  <PickButtons pick={p} busy={saving === i.id} onPick={(choice) => pick(i, { choice })} />
                  <NoteBox value={p?.comment || ""} onSave={(comment) => pick(i, { comment })} />
                </article>
              );
            })}
          </div>
        </section>
      )}

      {images.length > 0 && (
        <section className="mx-auto max-w-[1200px] px-4 pb-14 lg:px-8">
          <h2 className="mb-4 text-[22px] font-semibold tracking-tight">Looks</h2>
          <div className="columns-2 gap-3 md:columns-3 lg:columns-4">
            {images.map((i) => {
              const p = picks[i.id];
              return (
                <div key={i.id} className="relative mb-3 break-inside-avoid overflow-hidden rounded-soft">
                  <button onClick={() => setOpen(i)} className="block w-full" aria-label={`Open ${i.title || "image"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={i.url || ""} alt={i.title || ""} loading="lazy" className={`w-full transition-opacity ${p?.choice === "pass" ? "opacity-40" : ""}`} />
                  </button>
                  <button onClick={() => pick(i, { choice: p?.choice === "like" ? null : "like" })} aria-pressed={p?.choice === "like"} aria-label="Love it"
                    className={`absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full shadow-card transition-colors ${p?.choice === "like" ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-black/60 text-white hover:bg-black/80"}`}>
                    <Heart size={18} fill={p?.choice === "like" ? "currentColor" : "none"} />
                  </button>
                  {p?.comment && <span className="absolute bottom-2 left-2 rounded-full bg-black/60 p-2 text-white"><MessageSquare size={13} /></span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {ideas.length === 0 && images.length === 0 && (
        <p className="mx-auto max-w-[1200px] px-4 text-[14px] text-text-muted lg:px-8">Nothing on this board yet. We will let you know when it is ready.</p>
      )}

      <footer className="fixed inset-x-0 bottom-0 border-t border-[var(--border)] bg-[var(--bg)]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-3 text-[13px] lg:px-8">
          <span>{liked ? <><span className="font-semibold">{liked}</span> picked so far. Saved as you go.</> : "Tap the heart or Love it on anything you want us to make."}</span>
          {err && <span className="text-accent-red">{err}</span>}
        </div>
      </footer>

      {open && (
        <div role="dialog" aria-modal="true" onClick={() => setOpen(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div onClick={(e) => e.stopPropagation()} className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-panel bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={open.url || ""} alt={open.title || ""} className="max-h-[65vh] w-full bg-black object-contain" />
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[15px] font-medium">{open.title}</p>
                <button onClick={() => setOpen(null)} aria-label="Close" className="rounded-full p-1.5 text-text-muted hover:bg-[var(--surface-hover)]"><X size={18} /></button>
              </div>
              <PickButtons pick={picks[open.id]} busy={saving === open.id} onPick={(choice) => pick(open, { choice })} />
              <NoteBox value={picks[open.id]?.comment || ""} onSave={(comment) => pick(open, { comment })} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function PickButtons({ pick, busy, onPick }: { pick?: Pick; busy: boolean; onPick: (c: "like" | "pass" | null) => void }) {
  const base = "flex h-11 items-center gap-2 rounded-soft px-4 text-[14px] font-medium transition-colors";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => onPick(pick?.choice === "like" ? null : "like")} aria-pressed={pick?.choice === "like"}
        className={`${base} ${pick?.choice === "like" ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "border border-[var(--border)] hover:bg-[var(--surface-hover)]"}`}>
        <Heart size={16} fill={pick?.choice === "like" ? "currentColor" : "none"} /> Love it
      </button>
      <button onClick={() => onPick(pick?.choice === "pass" ? null : "pass")} aria-pressed={pick?.choice === "pass"}
        className={`${base} ${pick?.choice === "pass" ? "bg-[var(--surface-hover)] text-text" : "text-text-muted hover:text-text"}`}>
        {pick?.choice === "pass" ? <Check size={16} /> : <X size={16} />} Not for us
      </button>
      {busy && <Loader2 size={14} className="animate-spin text-text-muted" />}
    </div>
  );
}

function NoteBox({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const [open, setOpen] = useState(!!value);
  useEffect(() => { setV(value); if (value) setOpen(true); }, [value]);
  if (!open) {
    return <button onClick={() => setOpen(true)} className="self-start text-[13px] text-text-muted underline-offset-2 hover:text-text hover:underline">Add a note</button>;
  }
  return (
    <textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} rows={2} aria-label="Your note"
      placeholder="What would you change? e.g. love this, but in our green"
      className="rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[14px] outline-none placeholder:text-text-muted focus:border-[var(--brand-line)]" />
  );
}
