"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronUp, Download, Loader2, MessageSquare, Send, X } from "lucide-react";
import { useLogoTone, logoTile } from "@/lib/use-logo-tone";

/**
 * A client's Brand Reels order page (bconclub.com/brand-reels), opened from a share
 * link with no login. It walks the order the way the site promises:
 *
 *   01 Idea          3 to 5 reel ideas built from their products; they choose one
 *   02 Script        the script for that idea; approve or ask for a change
 *   03 Visual board  frame by frame; changes on frames count against the 3 included
 *   04 Final reel    watch and download
 *
 * Later stages appear once BCON adds them in ARC. The header is their world today,
 * a faded collage of what we pulled from their store.
 */

type Kind = "idea" | "image" | "script" | "frame" | "video";
type Item = { id: string; kind: Kind; title: string | null; body: string | null; url: string | null; featured: boolean; parent_id: string | null; position: number | null };
type Pick = { item_id: string; choice: "like" | "pass" | null; comment: string | null };
type Brand = { name: string; mood: string | null; palette: string[]; intro: string | null; logo_url: string | null; reel_length: string | null; changes_allowed: number; changes_used: number };
type Board = { brand: Brand; items: Item[]; mine: Pick[] };

const NAME_KEY = "studio:voter";
const STEPS = [
  { key: "idea", n: "01", label: "Idea" },
  { key: "script", n: "02", label: "Script" },
  { key: "board", n: "03", label: "Visual board" },
  { key: "final", n: "04", label: "Final reel" },
] as const;

export default function ReelOrder({ params, searchParams }: { params: { slug: string }; searchParams: { k?: string } }) {
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

  const v = useMemo(() => {
    const items = board?.items || [];
    const ideas = items.filter((i) => i.kind === "idea");
    const ideaIds = new Set(ideas.map((i) => i.id));
    const childrenOf = (id: string, kind: Kind) => items.filter((i) => i.kind === kind && i.parent_id === id);
    const pulled = items.filter((i) => i.kind === "image" && !(i.parent_id && ideaIds.has(i.parent_id)));
    // The idea the order is built on: the one that has a script/board/reel, else the client's choice.
    const built = ideas.find((i) => childrenOf(i.id, "script").length || childrenOf(i.id, "frame").length || childrenOf(i.id, "video").length);
    const chosen = built || ideas.find((i) => picks[i.id]?.choice === "like") || null;
    const script = chosen ? childrenOf(chosen.id, "script")[0] : items.find((i) => i.kind === "script");
    const frames = chosen ? childrenOf(chosen.id, "frame") : items.filter((i) => i.kind === "frame");
    const video = chosen ? childrenOf(chosen.id, "video")[0] : items.find((i) => i.kind === "video");
    const stage = video ? "final" : frames.length ? "board" : script ? "script" : "idea";
    return { ideas, childrenOf, pulled, built, chosen, script, frames, video, stage };
  }, [board, picks]);

  function saveName(e: React.FormEvent) {
    e.preventDefault();
    const n = nameDraft.replace(/\s+/g, " ").trim();
    if (!n) return;
    try { localStorage.setItem(NAME_KEY, n); } catch { /* private mode */ }
    setName(n); setNudge(false);
  }

  async function post(item: Item, next: Pick, patch: Partial<Pick>) {
    const r = await fetch(`/api/public/studio/${params.slug}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ k: key, item_id: item.id, voter: name, choice: next.choice, ...(patch.comment !== undefined ? { comment: patch.comment } : {}) }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "That did not save. Check your connection and try again.");
  }

  async function pick(item: Item, patch: Partial<Pick>) {
    if (!name) { setNudge(true); document.getElementById("who")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const prev = picks[item.id] || { item_id: item.id, choice: null, comment: null };
    const next = { ...prev, ...patch };
    setPicks((p) => ({ ...p, [item.id]: next }));
    setSaving(item.id); setErr(null); setSent("idle");
    try {
      await post(item, next, patch);
      if (patch.comment !== undefined) load(name); // refresh the changes counter
    } catch (e) {
      setPicks((p) => ({ ...p, [item.id]: prev })); setErr((e as Error).message);
    } finally { setSaving(null); }
  }

  /** One idea only: choosing it clears the choice on the others. */
  async function chooseIdea(idea: Item) {
    const on = picks[idea.id]?.choice === "like";
    await pick(idea, { choice: on ? null : "like" });
    if (on) return;
    for (const other of v.ideas) {
      if (other.id !== idea.id && picks[other.id]?.choice === "like") {
        const o = { ...picks[other.id], choice: null };
        setPicks((p) => ({ ...p, [other.id]: o }));
        post(other, o, {}).catch(() => {});
      }
    }
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
          <p className="text-[15px] text-text">This page is not available.</p>
          <p className="mt-1 text-[13px] text-text-muted">The link may have changed. Ask the BCON team for a fresh one.</p>
        </div>
      </main>
    );
  }
  if (!board) return <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-text-muted"><Loader2 className="animate-spin" size={20} /></main>;

  const { brand } = board;
  const stepIdx = STEPS.findIndex((s) => s.key === v.stage);
  const changesLeft = Math.max(0, brand.changes_allowed - brand.changes_used);
  const actionable = Object.values(picks).filter((p) => p.choice || p.comment);
  const byId = new Map(board.items.map((i) => [i.id, i]));
  const showIdeas = !v.built; // once we are building on an idea, the others step aside

  return (
    <main className="min-h-screen bg-[var(--bg)] pb-28 text-text">
      {/* ── Header: their brand today ── */}
      <header className="relative h-[320px] overflow-hidden sm:h-[400px]">
        {v.pulled.length > 0 && (
          <div aria-hidden className="absolute inset-0 grid grid-cols-3 gap-1 sm:grid-cols-5 lg:grid-cols-7">
            {v.pulled.slice(0, 21).map((i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i.id} src={i.url || ""} alt="" className="h-full min-h-[140px] w-full object-cover" />
            ))}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-[var(--bg)]" />
        <div className="relative mx-auto flex h-full max-w-[1200px] flex-col justify-between px-4 py-5 lg:px-8">
          <div className="flex justify-end">
            <span className="rounded-pill bg-black/50 px-3 py-1 text-[12px] text-white/80">BCON Brand Reels</span>
          </div>
          <div className="flex items-end gap-4 pb-2">
            {brand.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo_url} alt={`${brand.name} logo`} className={`h-20 w-auto max-w-[200px] rounded-soft object-contain p-2 shadow-card sm:h-24 ${logoTile(tone)}`} />
            )}
            <div>
              <p className="text-[13px] text-white/70">Your brand reel{brand.reel_length ? ` · ${brand.reel_length}` : ""}</p>
              <h1 className="text-[34px] font-bold leading-none tracking-[-0.03em] text-white sm:text-[48px]">{brand.name}</h1>
            </div>
          </div>
        </div>
      </header>

      {/* ── Where the order is ── */}
      <section className="mx-auto max-w-[1200px] px-4 pt-8 lg:px-8">
        <ol className="grid grid-cols-4 gap-2">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex flex-col gap-2">
              <div className={`h-1 rounded-full ${i < stepIdx ? "bg-[var(--brand)]" : i === stepIdx ? "bg-[var(--brand)]" : "bg-[var(--surface-hover)]"}`} />
              <span className={`text-[12px] sm:text-[13px] ${i <= stepIdx ? "text-text" : "text-text-muted"}`}>
                <span className="mr-1.5 font-mono text-text-muted">{s.n}</span>{s.label}
              </span>
            </li>
          ))}
        </ol>

        <h2 className="mt-10 max-w-[24ch] text-[30px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[42px]">
          {v.stage === "idea" ? `Pick the idea for your reel` : v.stage === "script" ? "Your script is ready" : v.stage === "board" ? "Your visual board is ready" : "Your reel is ready"}
        </h2>
        <p className="mt-3 max-w-[62ch] text-[16px] leading-relaxed text-text-muted">
          {brand.intro || (v.stage === "idea"
            ? "We made these ideas from your products. Choose the one you want as your reel, add a note if you like, and send your pick to us. We write the script from it."
            : v.stage === "script" ? "Read it through. Approve it, or tell us what to change. The delivery clock starts once your script is final."
            : v.stage === "board" ? `Every frame of your reel, planned before we generate it. Ask for changes on any frame. Your order includes ${brand.changes_allowed} changes.`
            : "Here is your final reel, scored and captioned. Download it and post it.")}
        </p>

        <form id="who" onSubmit={saveName}
          className={`mt-6 flex flex-wrap items-center gap-2 rounded-panel border p-4 transition-colors ${nudge ? "border-[var(--brand)] bg-[var(--brand-faint)]" : "border-[var(--border)] bg-surface"}`}>
          {name ? (
            <p className="text-[14px]">Reviewing as <span className="font-semibold">{name}</span>.{" "}
              <button type="button" onClick={() => setName("")} className="text-text-muted underline-offset-2 hover:text-text hover:underline">Not you?</button>
            </p>
          ) : (
            <>
              <label htmlFor="voter" className="w-full text-[14px] sm:w-auto">{nudge ? "Add your name first, so we know who picked:" : "Your name, so we know who picked:"}</label>
              <input id="voter" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoComplete="name" placeholder="e.g. Priya"
                className="h-11 w-full rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 text-[15px] outline-none focus:border-[var(--brand-line)] sm:w-60" />
              <button className="h-11 rounded-soft bg-[var(--brand)] px-5 text-[14px] font-semibold text-[var(--brand-ink)]">Start</button>
            </>
          )}
        </form>
      </section>

      {/* ── 04 Final reel ── */}
      {v.video?.url && (
        <section className="mx-auto max-w-[1200px] px-4 pt-12 lg:px-8">
          <h3 className="mb-4 text-[22px] font-semibold tracking-tight">Final reel</h3>
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <video src={v.video.url} controls playsInline className="aspect-[9/16] w-full max-w-[360px] rounded-panel bg-black object-contain" />
            <div className="flex flex-col gap-3">
              {v.video.title && <p className="text-[16px]">{v.video.title}</p>}
              <a href={v.video.url} download className="flex h-11 items-center gap-2 self-start rounded-soft bg-[var(--brand)] px-5 text-[14px] font-semibold text-[var(--brand-ink)]">
                <Download size={16} /> Download reel
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ── 03 Visual board ── */}
      {v.frames.length > 0 && (
        <section className="mx-auto max-w-[1200px] px-4 pt-12 lg:px-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h3 className="text-[22px] font-semibold tracking-tight">Visual board</h3>
            <span className={`rounded-pill px-3 py-1 text-[12.5px] font-medium ${changesLeft ? "bg-surface text-text" : "bg-[rgba(245,158,11,0.14)] text-accent-orange"}`}>
              {brand.changes_used} of {brand.changes_allowed} changes used
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {v.frames.map((f, n) => (
              <article key={f.id} className="flex flex-col overflow-hidden rounded-soft border border-[var(--border)] bg-surface">
                <button onClick={() => setZoom(f)} className="relative block" aria-label={`Frame ${n + 1} larger`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url || ""} alt={f.title || `Frame ${n + 1}`} loading="lazy" className="aspect-[9/16] w-full object-cover" />
                  <span className="absolute left-2 top-2 rounded-pill bg-black/70 px-2 py-0.5 font-mono text-[11px] text-white">{String(n + 1).padStart(2, "0")}</span>
                </button>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  {f.title && <p className="text-[13px] font-medium">{f.title}</p>}
                  {f.body && <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-text-muted">{f.body}</p>}
                  <NoteBox label="Change this frame" placeholder="What should change in this frame?" value={picks[f.id]?.comment || ""}
                    locked={!changesLeft && !picks[f.id]?.comment} onSave={(comment) => pick(f, { comment })} />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── 02 Script ── */}
      {v.script && (
        <section className="mx-auto max-w-[1200px] px-4 pt-12 lg:px-8">
          <h3 className="mb-4 text-[22px] font-semibold tracking-tight">Script</h3>
          <article className={`rounded-panel border p-5 lg:p-6 ${picks[v.script.id]?.choice === "like" ? "border-[var(--brand-line)]" : "border-[var(--border)]"} bg-surface`}>
            {v.script.title && <p className="mb-2 text-[13px] text-text-muted">{v.script.title}</p>}
            <p className="max-w-[70ch] whitespace-pre-wrap text-[16px] leading-relaxed">{v.script.body}</p>
            <div className="mt-5 flex flex-col gap-3">
              <button onClick={() => pick(v.script!, { choice: picks[v.script!.id]?.choice === "like" ? null : "like" })}
                className={`flex h-11 items-center gap-2 self-start rounded-soft px-4 text-[14px] font-medium ${picks[v.script.id]?.choice === "like" ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "border border-[var(--border)] hover:bg-[var(--surface-hover)]"}`}>
                <Check size={16} /> {picks[v.script.id]?.choice === "like" ? "Script approved" : "Approve script"}
              </button>
              <NoteBox label="Request a change" placeholder="What should change in the script?" value={picks[v.script.id]?.comment || ""}
                locked={!changesLeft && !picks[v.script.id]?.comment} onSave={(comment) => pick(v.script!, { comment })} />
            </div>
          </article>
        </section>
      )}

      {/* ── 01 Ideas ── */}
      {v.built ? (
        <section className="mx-auto max-w-[1200px] px-4 pt-12 lg:px-8">
          <h3 className="mb-3 text-[22px] font-semibold tracking-tight">Your idea</h3>
          <div className="rounded-panel border border-[var(--border)] bg-surface p-5">
            <p className="text-[18px] font-semibold">{v.built.title}</p>
            {v.built.body && <p className="mt-1 text-[14.5px] text-text-muted">{v.built.body}</p>}
          </div>
        </section>
      ) : showIdeas && (
        <section className="mx-auto max-w-[1200px] px-4 pt-12 lg:px-8">
          <h3 className="mb-1 text-[22px] font-semibold tracking-tight">The ideas</h3>
          <p className="mb-5 text-[14px] text-text-muted">Choose one. That is the reel we make.</p>
          {v.ideas.length === 0 && <p className="text-[14px] text-text-muted">Your ideas are being made. We will send you this link again when they are ready.</p>}
          <div className="flex flex-col gap-5">
            {v.ideas.map((idea, n) => {
              const on = picks[idea.id]?.choice === "like";
              const stills = v.childrenOf(idea.id, "image");
              return (
                <article key={idea.id} className={`rounded-panel border-2 p-5 transition-colors lg:p-6 ${on ? "border-[var(--brand)] bg-[var(--brand-faint)]" : "border-[var(--border)] bg-surface"}`}>
                  <div className="flex flex-col gap-5 lg:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <p className="text-[12px] font-medium text-text-muted">Idea {n + 1}</p>
                      <h4 className="text-[24px] font-semibold leading-snug tracking-tight">{idea.title}</h4>
                      {idea.body && <p className="max-w-[60ch] text-[15.5px] leading-relaxed text-text-muted">{idea.body}</p>}
                      <div className="mt-auto flex flex-col gap-3 pt-2">
                        <button onClick={() => chooseIdea(idea)} aria-pressed={on}
                          className={`flex h-12 items-center gap-2 self-start rounded-soft px-5 text-[15px] font-semibold transition-colors ${on ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "border border-[var(--border)] hover:bg-[var(--surface-hover)]"}`}>
                          {saving === idea.id ? <Loader2 size={16} className="animate-spin" /> : on ? <Check size={17} /> : null}
                          {on ? "This is my pick" : "Choose this idea"}
                        </button>
                        <NoteBox label="Add a note" placeholder="Anything to add? e.g. love it, but use our bridal set" value={picks[idea.id]?.comment || ""}
                          onSave={(comment) => pick(idea, { comment })} />
                      </div>
                    </div>
                    {stills.length > 0 && (
                      <div className="grid shrink-0 grid-cols-3 gap-2 lg:w-[480px]">
                        {stills.slice(0, 6).map((s) => (
                          <button key={s.id} onClick={() => setZoom(s)} className="overflow-hidden rounded-soft" aria-label={`View ${s.title || "still"} larger`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={s.url || ""} alt={s.title || ""} loading="lazy" className="aspect-[9/16] w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Bottom bar ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg)]">
        {tray && (
          <div className="mx-auto max-h-[55vh] max-w-[1200px] overflow-auto px-4 pt-4 lg:px-8">
            {actionable.length === 0 ? (
              <p className="pb-2 text-[13px] text-text-muted">Nothing yet.</p>
            ) : (
              <ul className="flex flex-col">
                {actionable.map((p) => {
                  const it = byId.get(p.item_id);
                  if (!it) return null;
                  const label = it.kind === "idea" ? (p.choice === "like" ? "Chosen idea" : p.choice === "pass" ? "Not for us" : "Note")
                    : it.kind === "script" ? (p.comment ? "Change asked" : "Approved") : it.kind === "frame" ? "Change asked" : p.choice === "like" ? "Liked" : "Note";
                  return (
                    <li key={p.item_id} className="flex items-center gap-3 border-t border-[var(--border)] py-2.5 first:border-t-0">
                      {it.url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={it.url} alt="" className="h-12 w-9 shrink-0 rounded-soft object-cover" />
                        : <span className="flex h-12 w-9 shrink-0 items-center justify-center rounded-soft bg-surface text-[10px] capitalize text-text-muted">{it.kind}</span>}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px]">{it.title || (it.kind === "frame" ? `Frame ${(v.frames.indexOf(it) + 1) || ""}` : it.kind)}</p>
                        {p.comment && <p className="truncate text-[12px] text-text-muted">“{p.comment}”</p>}
                      </div>
                      <span className={`shrink-0 rounded-pill px-2 py-0.5 text-[11.5px] font-semibold ${p.choice === "like" ? "bg-[var(--brand-soft)] text-[var(--brand-text)]" : "bg-[var(--surface-hover)] text-text"}`}>{label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <button onClick={() => setTray((t) => !t)} aria-expanded={tray} className="flex min-w-0 items-center gap-2 text-left text-[13.5px]">
            <span className="flex h-8 min-w-8 items-center justify-center rounded-pill bg-[var(--brand)] px-2 text-[13px] font-bold text-[var(--brand-ink)]">{actionable.length}</span>
            <span className="min-w-0 truncate">
              {v.stage === "idea"
                ? (v.chosen ? <>Your pick: <span className="font-semibold">{v.chosen.title}</span></> : "Choose an idea")
                : `${brand.changes_used} of ${brand.changes_allowed} changes used`}
              <span className="ml-1 text-text-muted">{sent === "sent" ? "· sent to BCON" : "· saved as you go"}</span>
            </span>
            <ChevronUp size={16} className={`shrink-0 text-text-muted transition-transform ${tray ? "" : "rotate-180"}`} />
          </button>
          <div className="flex items-center gap-3">
            {err && <span className="text-[12.5px] text-accent-red">{err}</span>}
            <button onClick={sendPicks} disabled={!name || !actionable.length || sent === "sending" || (v.stage === "idea" && !v.chosen)}
              className="flex h-10 items-center gap-2 rounded-soft bg-[var(--brand)] px-4 text-[13.5px] font-semibold text-[var(--brand-ink)] disabled:opacity-40">
              {sent === "sending" ? <Loader2 size={15} className="animate-spin" /> : sent === "sent" ? <Check size={15} /> : <Send size={15} />}
              {sent === "sent" ? "Sent. Thank you" : v.stage === "idea" ? "Send my pick to BCON" : "Send to BCON"}
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

function NoteBox({ label, placeholder, value, onSave, locked }: { label: string; placeholder: string; value: string; onSave: (v: string) => void; locked?: boolean }) {
  const [v, setV] = useState(value);
  const [open, setOpen] = useState(!!value);
  useEffect(() => { setV(value); if (value) setOpen(true); }, [value]);
  if (locked) return <p className="text-[12.5px] text-text-muted">All included changes are used. Message us for more.</p>;
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 self-start text-[13px] text-text-muted underline-offset-2 hover:text-text hover:underline">
        <MessageSquare size={13} /> {label}
      </button>
    );
  }
  return (
    <textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} rows={2} aria-label={label} placeholder={placeholder}
      className="rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[14px] outline-none placeholder:text-text-muted focus:border-[var(--brand-line)]" />
  );
}
