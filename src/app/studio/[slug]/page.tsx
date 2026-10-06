"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronUp, Heart, Loader2, Send, X } from "lucide-react";
import { useLogoTone, logoTile } from "@/lib/use-logo-tone";

/**
 * A client's view of one brand board, opened from a share link. No ARC login.
 *
 * Order of the page, top to bottom:
 *   header   their own world: a collage of what we pulled from their store, logo, name
 *   rework   "Brand rework by BCON": who is picking, the mood, then the ideas
 *   ideas    the main event: each idea with 3 to 5 visual options to choose between
 *   bar      a bottom bar with their picks; review and send them to us from there
 */

type Item = { id: string; kind: "idea" | "image"; title: string | null; body: string | null; url: string | null; featured: boolean; parent_id: string | null };
type Pick = { item_id: string; choice: "like" | "pass" | null; comment: string | null };
type Board = { brand: { name: string; mood: string | null; palette: string[]; intro: string | null; logo_url: string | null }; items: Item[]; mine: Pick[] };

const NAME_KEY = "studio:voter";
const LETTERS = "ABCDEFGH";

export default function SharedBoard({ params, searchParams }: { params: { slug: string }; searchParams: { k?: string } }) {
  const key = searchParams.k || "";
  const [board, setBoard] = useState<Board | null>(null);
  const [gone, setGone] = useState(false);
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nudge, setNudge] = useState(false);
  const [tray, setTray] = useState(false);
  const [sent, setSent] = useState<"idle" | "sending" | "sent">("idle");
  const [zoom, setZoom] = useState<Item | null>(null);
  const tone = useLogoTone(board?.brand.logo_url);

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

  const { ideas, optionsOf, pulled } = useMemo(() => {
    const items = board?.items || [];
    const ideas = items.filter((i) => i.kind === "idea");
    const ideaIds = new Set(ideas.map((i) => i.id));
    const optionsOf = (id: string) => items.filter((i) => i.kind === "image" && i.parent_id === id);
    // Everything not attached to an idea is what we were given: their store, their photos.
    const pulled = items.filter((i) => i.kind === "image" && !(i.parent_id && ideaIds.has(i.parent_id)));
    return { ideas, optionsOf, pulled };
  }, [board]);

  function saveName(e: React.FormEvent) {
    e.preventDefault();
    const n = nameDraft.replace(/\s+/g, " ").trim();
    if (!n) return;
    try { localStorage.setItem(NAME_KEY, n); } catch { /* private mode */ }
    setName(n); setNudge(false);
  }

  async function pick(item: Item, patch: Partial<Pick>) {
    if (!name) { setNudge(true); document.getElementById("who")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const prev = picks[item.id] || { item_id: item.id, choice: null, comment: null };
    const next = { ...prev, ...patch };
    setPicks((p) => ({ ...p, [item.id]: next }));
    setSaving(item.id); setErr(null); setSent("idle");
    const r = await fetch(`/api/public/studio/${params.slug}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ k: key, item_id: item.id, voter: name, choice: next.choice, ...(patch.comment !== undefined ? { comment: patch.comment } : {}) }),
    });
    setSaving(null);
    if (!r.ok) { setPicks((p) => ({ ...p, [item.id]: prev })); setErr("That pick did not save. Check your connection and try again."); }
  }

  async function sendPicks() {
    setSent("sending"); setErr(null);
    const r = await fetch(`/api/public/studio/${params.slug}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ k: key, voter: name, submit: true }),
    });
    if (r.ok) setSent("sent");
    else { setSent("idle"); setErr((await r.json().catch(() => ({}))).error || "Could not send. Try again."); }
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

  const { brand } = board;
  const all = Object.values(picks);
  const loved = all.filter((p) => p.choice === "like");
  const noted = all.filter((p) => p.comment);
  const byId = new Map(board.items.map((i) => [i.id, i]));

  return (
    <main className="min-h-screen bg-[var(--bg)] pb-28 text-text">
      {/* ── Header: their world, from what we pulled ── */}
      <header className="relative h-[340px] overflow-hidden sm:h-[420px]">
        {pulled.length > 0 && (
          <div aria-hidden className="absolute inset-0 grid grid-cols-3 gap-1 sm:grid-cols-5 lg:grid-cols-7">
            {pulled.slice(0, 21).map((i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i.id} src={i.url || ""} alt="" className="h-full min-h-[140px] w-full object-cover" />
            ))}
          </div>
        )}
        {/* Fades the collage into the page so the header reads as one image, not a grid. */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-[var(--bg)]" />
        <div className="relative mx-auto flex h-full max-w-[1200px] flex-col justify-between px-4 py-5 lg:px-8">
          <div className="flex items-center justify-end">
            <span className="rounded-pill bg-black/50 px-3 py-1 text-[12px] text-white/80">Prepared by BCON</span>
          </div>
          <div className="flex items-end gap-4 pb-2">
            {brand.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo_url} alt={`${brand.name} logo`} className={`h-20 w-auto max-w-[200px] rounded-soft object-contain p-2 shadow-card sm:h-24 ${logoTile(tone)}`} />
            )}
            <div>
              <p className="text-[13px] text-white/70">{pulled.length ? "Where you are today" : "Brand rework"}</p>
              <h1 className="text-[34px] font-bold leading-none tracking-[-0.03em] text-white sm:text-[48px]">{brand.name}</h1>
            </div>
          </div>
        </div>
      </header>

      {/* ── Brand rework ── */}
      <section className="mx-auto max-w-[1200px] px-4 pt-10 lg:px-8">
        <p className="text-[13px] font-medium text-[var(--brand-text)]">Brand rework by BCON</p>
        <h2 className="mt-2 max-w-[22ch] text-[32px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[44px]">Where we want to take {brand.name}</h2>
        <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-text-muted">
          {brand.intro || "Below is the mood we are going after and a few ideas, each with options built from your products. Pick the ones you love, pass on what is not you, and add a note anywhere. Then send your picks to us from the bar at the bottom."}
        </p>

        <form id="who" onSubmit={saveName}
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

      {/* ── The mood ── */}
      {(brand.mood || brand.palette.length > 0) && (
        <section className="mx-auto max-w-[1200px] px-4 pt-14 lg:px-8">
          <h3 className="mb-4 text-[22px] font-semibold tracking-tight">The mood</h3>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
            {brand.mood && (
              <p className="flex-1 rounded-panel border border-[var(--border)] bg-surface p-5 text-[20px] leading-snug">{brand.mood}</p>
            )}
            {brand.palette.length > 0 && (
              <div className="flex min-h-[110px] overflow-hidden rounded-panel border border-[var(--border)] sm:w-[340px]">
                {brand.palette.map((c) => <div key={c} className="flex-1" style={{ background: c }} title={c} />)}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── The ideas ── */}
      <section className="mx-auto max-w-[1200px] px-4 pt-14 lg:px-8">
        <h3 className="mb-1 text-[22px] font-semibold tracking-tight">The ideas</h3>
        <p className="mb-5 text-[14px] text-text-muted">Each idea comes with options. Tap the options you like, then tell us how you feel about the idea.</p>
        {ideas.length === 0 && <p className="text-[14px] text-text-muted">Ideas are on their way. We will let you know when they are ready.</p>}
        <div className="flex flex-col gap-6">
          {ideas.map((idea, n) => {
            const p = picks[idea.id];
            const opts = optionsOf(idea.id);
            return (
              <article key={idea.id} className={`rounded-panel border p-5 transition-colors lg:p-6 ${p?.choice === "like" ? "border-[var(--brand-line)]" : "border-[var(--border)]"} bg-surface`}>
                <p className="text-[12px] font-medium text-text-muted">Idea {n + 1}</p>
                <h4 className="mt-1 text-[22px] font-semibold leading-snug tracking-tight">{idea.title}</h4>
                {idea.body && <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed text-text-muted">{idea.body}</p>}

                {opts.length > 0 ? (
                  <div className={`mt-5 grid gap-3 ${opts.length >= 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
                    {opts.map((o, j) => {
                      const on = picks[o.id]?.choice === "like";
                      return (
                        <div key={o.id} className={`group relative overflow-hidden rounded-soft ring-2 transition-shadow ${on ? "ring-[var(--brand)]" : "ring-transparent"}`}>
                          <button onClick={() => setZoom(o)} className="block w-full" aria-label={`View option ${LETTERS[j]} larger`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={o.url || ""} alt={o.title || `Option ${LETTERS[j]}`} loading="lazy" className="aspect-[4/5] w-full object-cover" />
                          </button>
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-2.5 pt-8">
                            <span className="truncate text-[12.5px] font-medium text-white">Option {LETTERS[j]}{o.title ? ` · ${o.title}` : ""}</span>
                            <button onClick={() => pick(o, { choice: on ? null : "like" })} aria-pressed={on}
                              className={`flex h-9 shrink-0 items-center gap-1 rounded-pill px-3 text-[12.5px] font-semibold transition-colors ${on ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white/90 text-black hover:bg-white"}`}>
                              {on ? <Check size={14} /> : <Heart size={13} />} {on ? "Picked" : "Pick"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-4 rounded-soft border border-dashed border-[var(--border)] px-4 py-6 text-center text-[13px] text-text-muted">Options for this idea are being made.</p>
                )}

                <div className="mt-5 flex flex-col gap-3">
                  <IdeaVerdict pick={p} busy={saving === idea.id} onPick={(choice) => pick(idea, { choice })} />
                  <NoteBox value={p?.comment || ""} onSave={(comment) => pick(idea, { comment })} />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── Bottom bar: picks, review, send ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg)]">
        {tray && (
          <div className="mx-auto max-h-[55vh] max-w-[1200px] overflow-auto px-4 pt-4 lg:px-8">
            {all.filter((p) => p.choice || p.comment).length === 0 ? (
              <p className="pb-2 text-[13px] text-text-muted">Nothing picked yet.</p>
            ) : (
              <ul className="flex flex-col">
                {all.filter((p) => p.choice || p.comment).map((p) => {
                  const it = byId.get(p.item_id);
                  if (!it) return null;
                  const parent = it.parent_id ? byId.get(it.parent_id) : null;
                  return (
                    <li key={p.item_id} className="flex items-center gap-3 border-t border-[var(--border)] py-2.5 first:border-t-0">
                      {it.url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={it.url} alt="" className="h-12 w-10 shrink-0 rounded-soft object-cover" />
                        : <span className="flex h-12 w-10 shrink-0 items-center justify-center rounded-soft bg-surface text-[10px] text-text-muted">Idea</span>}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px]">{parent ? `${parent.title}: ${it.title || "option"}` : it.title}</p>
                        {p.comment && <p className="truncate text-[12px] text-text-muted">“{p.comment}”</p>}
                      </div>
                      <span className={`shrink-0 rounded-pill px-2 py-0.5 text-[11.5px] font-semibold ${p.choice === "like" ? "bg-[var(--brand-soft)] text-[var(--brand-text)]" : p.choice === "pass" ? "bg-[var(--surface-hover)] text-text-muted" : "bg-[var(--surface-hover)] text-text"}`}>
                        {p.choice === "like" ? (parent ? "Picked" : "Love it") : p.choice === "pass" ? "Not for us" : "Note"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <button onClick={() => setTray((v) => !v)} aria-expanded={tray} className="flex items-center gap-2 text-left text-[13.5px]">
            <span className="flex h-8 min-w-8 items-center justify-center rounded-pill bg-[var(--brand)] px-2 text-[13px] font-bold text-[var(--brand-ink)]">{loved.length}</span>
            <span>
              picked{noted.length ? `, ${noted.length} note${noted.length > 1 ? "s" : ""}` : ""}
              <span className="ml-1 text-text-muted">{sent === "sent" ? "· sent to BCON" : "· saved as you go"}</span>
            </span>
            <ChevronUp size={16} className={`text-text-muted transition-transform ${tray ? "" : "rotate-180"}`} />
          </button>
          <div className="flex items-center gap-3">
            {err && <span className="text-[12.5px] text-accent-red">{err}</span>}
            <button onClick={sendPicks} disabled={!name || !all.some((p) => p.choice || p.comment) || sent === "sending"}
              className="flex h-10 items-center gap-2 rounded-soft bg-[var(--brand)] px-4 text-[13.5px] font-semibold text-[var(--brand-ink)] disabled:opacity-40">
              {sent === "sending" ? <Loader2 size={15} className="animate-spin" /> : sent === "sent" ? <Check size={15} /> : <Send size={15} />}
              {sent === "sent" ? "Sent. Thank you" : "Send picks to BCON"}
            </button>
          </div>
        </div>
      </div>

      {zoom && (
        <div role="dialog" aria-modal="true" onClick={() => setZoom(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div onClick={(e) => e.stopPropagation()} className="relative max-h-full max-w-4xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom.url || ""} alt={zoom.title || ""} className="max-h-[85vh] rounded-soft object-contain" />
            <button onClick={() => setZoom(null)} aria-label="Close" className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white"><X size={18} /></button>
          </div>
        </div>
      )}
    </main>
  );
}

function IdeaVerdict({ pick, busy, onPick }: { pick?: Pick; busy: boolean; onPick: (c: "like" | "pass" | null) => void }) {
  const base = "flex h-11 items-center gap-2 rounded-soft px-4 text-[14px] font-medium transition-colors";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => onPick(pick?.choice === "like" ? null : "like")} aria-pressed={pick?.choice === "like"}
        className={`${base} ${pick?.choice === "like" ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "border border-[var(--border)] hover:bg-[var(--surface-hover)]"}`}>
        <Heart size={16} fill={pick?.choice === "like" ? "currentColor" : "none"} /> Love this idea
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
      placeholder="What would you change? e.g. love option B, but in our green"
      className="rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[14px] outline-none placeholder:text-text-muted focus:border-[var(--brand-line)]" />
  );
}
