"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, Home, ListChecks, Loader2, MessageSquare, MessageSquarePlus, Send, User, X } from "lucide-react";
import { useLogoTone, logoTile } from "@/lib/use-logo-tone";
import { Viewer, type ViewerImage } from "@/components/studio/Viewer";
import { IdeaDeck } from "@/components/studio/IdeaDeck";
import { StepTimeline } from "@/components/studio/StepTimeline";
import { useBackToClose } from "@/components/studio/useBackToClose";
import { VERSION } from "@/lib/version";

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
type Pick = { item_id: string; choice: "like" | "pass" | null; comment: string | null; sent_at?: string | null };
type Brand = { name: string; mood: string | null; palette: string[]; intro: string | null; logo_url: string | null; reel_length: string | null; changes_allowed: number; changes_used: number };
type Input = { id: string; body: string; created_at: string };
type Board = { brand: Brand; items: Item[]; mine: Pick[]; inputs?: Input[] };

const NAME_KEY = "studio:voter";
const STEPS = [
  { key: "idea", n: "01", label: "Idea", detail: "Say yes to the ideas that excite you." },
  { key: "script", n: "02", label: "Script", detail: "We write it from your yes. You approve it." },
  { key: "board", n: "03", label: "Visual board", detail: "Every frame planned before we make it." },
  { key: "final", n: "04", label: "Final reel", detail: "Scored, captioned, ready to post." },
] as const;

export default function ReelOrder({ params, searchParams }: { params: { slug: string }; searchParams: { k?: string } }) {
  const key = searchParams.k || "";
  const [board, setBoard] = useState<Board | null>(null);
  const [gone, setGone] = useState(false);
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [err, setErr] = useState<string | null>(null);
  const [nudge, setNudge] = useState(false);
  // The bottom tab bar opens one sheet at a time: your picks, or inputs for BCON.
  const [sheet, setSheet] = useState<"picks" | "inputs" | null>(null);
  const [sent, setSent] = useState<"idle" | "sending" | "sent">("idle");
  // The full-screen viewer: one set of images (an idea's scenes, the visual board) and where to start.
  const [viewer, setViewer] = useState<{ images: ViewerImage[]; start: number; label: string } | null>(null);
  const [profile, setProfile] = useState(false);
  const tone = useLogoTone(board?.brand.logo_url);
  const session = useRef("");
  const opened = useRef(false);

  /** Activity ping for the BCON team's feed. Fire and forget: never blocks the page. */
  const ping = useCallback((event: "open" | "name" | "view" | "tray", who: string, itemId?: string) => {
    if (!session.current) {
      try { session.current = sessionStorage.getItem("studio:session") || ""; } catch { /* private mode */ }
      if (!session.current) {
        session.current = Math.random().toString(36).slice(2, 12);
        try { sessionStorage.setItem("studio:session", session.current); } catch { /* private mode */ }
      }
    }
    fetch(`/api/public/studio/${params.slug}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
      body: JSON.stringify({ k: key, event, voter: who, item_id: itemId, session: session.current }),
    }).catch(() => {});
  }, [params.slug, key]);

  function openSet(items: Item[], start: number, label: string, caption?: (i: Item) => string | null) {
    setViewer({ images: items.map((i) => ({ id: i.id, url: i.url, title: i.title, caption: caption ? caption(i) : null })), start, label });
  }
  const seen = useRef(new Set<string>());
  const onSeen = useCallback((img: ViewerImage) => {
    if (seen.current.has(img.id)) return;
    seen.current.add(img.id);
    ping("view", name, img.id);
  }, [ping, name]);
  function openSheet(which: "picks" | "inputs") {
    setSheet((cur) => {
      const next = cur === which ? null : which;
      if (next === "picks") ping("tray", name);
      return next;
    });
  }
  /** "Not you?": forget this person on this device and start the page fresh for the next one. */
  function switchPerson() {
    try { localStorage.removeItem(NAME_KEY); } catch { /* private mode */ }
    setName(""); setNameDraft(""); setPicks({}); setSheet(null); setProfile(false);
    setSent("idle"); setErr(null); setNudge(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function askName() {
    setSheet(null); setNudge(true);
    document.getElementById("who")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  async function sendInput(text: string): Promise<boolean> {
    if (!name) { askName(); return false; }
    const res = await fetch(`/api/public/studio/${params.slug}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ k: key, voter: name, input: text, session: session.current }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(j.error || "Could not send that. Try again."); return false; }
    setBoard((b) => (b ? { ...b, inputs: [j.input, ...(b.inputs || [])] } : b));
    return true;
  }

  useEffect(() => {
    try { const n = localStorage.getItem(NAME_KEY); if (n) { setName(n); setNameDraft(n); } } catch { /* private mode */ }
  }, []);

  const load = useCallback(async (who: string) => {
    const r = await fetch(`/api/public/studio/${params.slug}?k=${encodeURIComponent(key)}&voter=${encodeURIComponent(who)}`, { cache: "no-store" });
    if (!r.ok) return setGone(true);
    const b: Board = await r.json();
    setBoard(b);
    if (!opened.current) { opened.current = true; ping("open", who); }
    setPicks(Object.fromEntries(b.mine.map((p) => [p.item_id, p])));
  }, [params.slug, key, ping]);
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
    ping("name", n);
  }

  async function post(item: Item, next: Pick, patch: Partial<Pick>) {
    const r = await fetch(`/api/public/studio/${params.slug}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ k: key, item_id: item.id, voter: name, choice: next.choice, session: session.current, ...(patch.comment !== undefined ? { comment: patch.comment } : {}) }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "That did not save. Check your connection and try again.");
  }

  async function pick(item: Item, patch: Partial<Pick>) {
    if (!name) { setNudge(true); document.getElementById("who")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const prev = picks[item.id] || { item_id: item.id, choice: null, comment: null };
    const next = { ...prev, ...patch, sent_at: null }; // any change is a draft until sent
    setPicks((p) => ({ ...p, [item.id]: next }));
    setErr(null); setSent("idle");
    try {
      await post(item, next, patch);
      if (patch.comment !== undefined) load(name); // refresh the changes counter
    } catch (e) {
      setPicks((p) => ({ ...p, [item.id]: prev })); setErr((e as Error).message);
    }
  }


  async function sendPicks() {
    setSent("sending"); setErr(null);
    const r = await fetch(`/api/public/studio/${params.slug}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ k: key, voter: name, submit: true, session: session.current }),
    });
    if (r.ok) {
      const j = await r.json();
      setPicks((p) => Object.fromEntries(Object.entries(p).map(([k, x]) => [k, { ...x, sent_at: j.sent_at }])));
      setSent("sent");
    }
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
  // Draft until sent: nothing reaches BCON before the client presses send.
  const unsent = actionable.filter((p) => !p.sent_at);
  const everSent = actionable.some((p) => p.sent_at);
  const allSent = actionable.length > 0 && unsent.length === 0;
  const byId = new Map(board.items.map((i) => [i.id, i]));
  const showIdeas = !v.built; // once we are building on an idea, the others step aside
  const yesIdeas = v.ideas.filter((i) => picks[i.id]?.choice === "like");

  return (
    <main className="min-h-screen bg-[var(--bg)] pb-40 text-text">
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
          <div className="flex items-center justify-end gap-2">
            <span className="rounded-pill bg-black/50 px-3 py-1 text-[12px] text-white/80">BCON Brand Reels</span>
            {name && (
              <button onClick={() => setProfile(true)} aria-label="Your picks"
                className="flex h-9 items-center gap-2 rounded-pill bg-black/60 pl-1 pr-3 text-[13px] text-white hover:bg-black/80">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand)] text-[12px] font-bold text-[var(--brand-ink)]">
                  {name.slice(0, 1).toUpperCase()}
                </span>
                {name}
              </button>
            )}
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
        <StepTimeline steps={STEPS} current={stepIdx} compact />

        <h2 className="mt-10 max-w-[24ch] text-[30px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[42px]">
          {v.stage === "idea" ? `Which ideas excite you?` : v.stage === "script" ? "Your script is ready" : v.stage === "board" ? "Your visual board is ready" : "Your reel is ready"}
        </h2>
        <p className="mt-3 max-w-[62ch] text-[16px] leading-relaxed text-text-muted">
          {brand.intro || (v.stage === "idea"
            ? "We made these ideas from your products. Swipe through them: yes to the ones that excite you, nope to the rest, and add a note if you like. Nothing reaches us until you press Send; then we write the script from your yes."
            : v.stage === "script" ? "Read it through. Approve it, or tell us what to change. The delivery clock starts once your script is final."
            : v.stage === "board" ? `Every frame of your reel, planned before we generate it. Ask for changes on any frame. Your order includes ${brand.changes_allowed} changes.`
            : "Here is your final reel, scored and captioned. Download it and post it.")}
        </p>

        {v.stage === "idea" && allSent && (
          <div className="mt-6 flex items-start gap-3 rounded-panel border border-[var(--brand-line)] bg-[var(--brand-faint)] p-4">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--brand-ink)]"><Check size={15} /></span>
            <div>
              <p className="text-[15px] font-semibold">
                {yesIdeas.length ? `Your answers are with us: yes to ${yesIdeas.map((i) => i.title).join(", ")}` : "Your answers are with us"}
              </p>
              <p className="mt-1 text-[14px] leading-relaxed text-text-muted">
                {yesIdeas.length
                  ? "Next we write the script. It appears on this page for you to approve or change, and we message you when it is ready. You can still change your answers or add inputs until then."
                  : "None of these felt right, and that helps. Tell us what you want under Inputs and we will come back with new ideas."}
              </p>
            </div>
          </div>
        )}

        <form id="who" onSubmit={saveName}
          className={`mt-6 flex flex-wrap items-center gap-2 rounded-panel border p-4 transition-colors ${nudge ? "border-[var(--brand)] bg-[var(--brand-faint)]" : "border-[var(--border)] bg-surface"}`}>
          {name ? (
            <p className="text-[14px]">Reviewing as <span className="font-semibold">{name}</span>.{" "}
              <button type="button" onClick={switchPerson} className="text-text-muted underline-offset-2 hover:text-text hover:underline">Not you?</button>
            </p>
          ) : (
            <>
              <label htmlFor="voter" className="w-full text-[14px] sm:w-auto">{nudge ? "Add your name first, so we know who picked:" : "Your name, so we know who picked:"}</label>
              <div className="flex w-full gap-2 sm:w-auto">
                <input id="voter" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoComplete="name" placeholder="e.g. Priya"
                  className="h-11 min-w-0 flex-1 rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 text-[15px] outline-none focus:border-[var(--brand-line)] sm:w-60 sm:flex-none" />
                <button className="h-11 shrink-0 rounded-soft bg-[var(--brand)] px-5 text-[14px] font-semibold text-[var(--brand-ink)]">Start</button>
              </div>
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
                <button onClick={() => openSet(v.frames, n, "Visual board", (i) => i.body)} className="relative block" aria-label={`Frame ${n + 1} larger`}>
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
          <p className="mb-5 text-[14px] text-text-muted">One card per idea. Swipe right if it excites you, left if it is not for you.</p>
          {v.ideas.length === 0 && <p className="text-[14px] text-text-muted">Your ideas are being made. We will send you this link again when they are ready.</p>}
          <IdeaDeck
            key={name || "anon"}
            ideas={v.ideas.map((i) => ({ id: i.id, title: i.title, body: i.body, image: v.childrenOf(i.id, "image")[0]?.url ?? null }))}
            decisions={Object.fromEntries(v.ideas.map((i) => [i.id, picks[i.id]?.choice ?? null]))}
            palette={brand.palette}
            ready={!!name}
            onNeedName={askName}
            onDecide={(id, choice) => { const it = byId.get(id); if (it) pick(it, { choice }); }}
            onOpenImage={(n) => { const idea = v.ideas[n]; const imgs = idea ? v.childrenOf(idea.id, "image") : []; if (imgs.length) openSet(imgs, 0, idea.title || `Idea ${n + 1}`); }}
            renderNote={(id) => { const it = byId.get(id); return it ? <NoteBox label="Add a note" placeholder="Anything to add? e.g. love it, but use our gift box" value={picks[id]?.comment || ""} onSave={(comment) => pick(it, { comment })} /> : null; }}
          />
        </section>
      )}

      <SiteFooter brand={brand.name} current={stepIdx} />

      {/* ── Bottom: a send strip while something is unsent, then the tab bar ── */}
      <div className="fixed inset-x-0 bottom-0 z-40">
        {name && actionable.length > 0 && !allSent && (
          <div className="border-t border-[var(--brand-line)] bg-[var(--bg)]">
            <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 bg-[var(--brand-faint)] px-4 py-2.5 lg:px-8">
              <p className="min-w-0 truncate text-[13px]">
                {err ? <span className="text-accent-red">{err}</span>
                  : v.stage === "idea" ? <>{yesIdeas.length} yes · {v.ideas.filter((i) => picks[i.id]?.choice === "pass").length} no · <span className="text-text-muted">not sent yet</span></>
                  : `${unsent.length} change${unsent.length === 1 ? "" : "s"} not sent yet`}
              </p>
              <button onClick={sendPicks} disabled={sent === "sending"}
                className="flex h-10 shrink-0 items-center gap-2 rounded-soft bg-[var(--brand)] px-4 text-[13.5px] font-semibold text-[var(--brand-ink)] disabled:opacity-40">
                {sent === "sending" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {everSent ? "Send changes" : v.stage === "idea" ? "Send my answers" : "Send to BCON"}
              </button>
            </div>
          </div>
        )}
        <nav aria-label="Page" className="border-t border-[var(--border)] bg-[var(--bg)] pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto grid max-w-[560px] grid-cols-4">
            <TabButton label="Home" active={!sheet && !profile} onClick={() => { setSheet(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <Home size={20} />
            </TabButton>
            <TabButton label="Inputs" active={sheet === "inputs"} onClick={() => openSheet("inputs")} badge={board.inputs?.length || 0}>
              <MessageSquarePlus size={20} />
            </TabButton>
            <TabButton label="Picks" active={sheet === "picks"} onClick={() => openSheet("picks")} badge={actionable.length} dot={actionable.length > 0 && !allSent}>
              <ListChecks size={20} />
            </TabButton>
            <TabButton label={name ? name.split(" ")[0] : "Profile"} active={profile} onClick={() => { if (name) { setSheet(null); setProfile(true); } else askName(); }}>
              {name
                ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand)] text-[11.5px] font-bold text-[var(--brand-ink)]">{name.slice(0, 1).toUpperCase()}</span>
                : <User size={20} />}
            </TabButton>
          </div>
        </nav>
      </div>

      {sheet && (
        <BottomSheet title={sheet === "picks" ? "Your picks" : "Inputs for BCON"} onClose={() => setSheet(null)}>
          {sheet === "picks" ? (
            <>
              <p className={`mb-3 text-[13px] ${allSent ? "text-accent-green" : "text-text-muted"}`}>
                {!actionable.length ? "Nothing yet. Choose an idea and it shows up here."
                  : allSent ? "Everything here is sent to BCON."
                  : everSent ? "Some changes are not sent yet. Send them below." : "Draft: nothing reaches BCON until you send."}
              </p>
              <ul className="flex flex-col">
                {actionable.map((p) => {
                  const it = byId.get(p.item_id);
                  if (!it) return null;
                  const label = it.kind === "idea" ? (p.choice === "like" ? "Yes, excited" : p.choice === "pass" ? "Not for us" : "Note")
                    : it.kind === "script" ? (p.comment ? "Change asked" : "Approved") : it.kind === "frame" ? "Change asked" : p.choice === "like" ? "Liked" : "Note";
                  return (
                    <li key={p.item_id} className="flex items-center gap-3 border-t border-[var(--border)] py-2.5 first:border-t-0">
                      {it.url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={it.url} alt="" className="h-12 w-9 shrink-0 rounded-soft object-cover" />
                        : <span className="flex h-12 w-9 shrink-0 items-center justify-center rounded-soft bg-[var(--bg)] text-[10px] capitalize text-text-muted">{it.kind}</span>}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px]">{it.title || (it.kind === "frame" ? `Frame ${(v.frames.indexOf(it) + 1) || ""}` : it.kind)}</p>
                        {p.comment && <p className="truncate text-[12px] text-text-muted">“{p.comment}”</p>}
                      </div>
                      <span className={`shrink-0 rounded-pill px-2 py-0.5 text-[11.5px] font-semibold ${p.choice === "like" ? "bg-[var(--brand-soft)] text-[var(--brand-text)]" : "bg-[var(--surface-hover)] text-text"}`}>{label}</span>
                    </li>
                  );
                })}
              </ul>
              {actionable.length > 0 && (
                <button onClick={sendPicks} disabled={!name || allSent || sent === "sending"}
                  className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-soft bg-[var(--brand)] text-[14px] font-semibold text-[var(--brand-ink)] disabled:opacity-40">
                  {sent === "sending" ? <Loader2 size={15} className="animate-spin" /> : allSent ? <Check size={15} /> : <Send size={15} />}
                  {allSent ? "Sent to BCON" : everSent ? "Send changes to BCON" : v.stage === "idea" ? "Send my answers to BCON" : "Send to BCON"}
                </button>
              )}
              {err && <p className="mt-2 text-[12.5px] text-accent-red">{err}</p>}
            </>
          ) : (
            <InputsPanel name={name} inputs={board.inputs || []} onSend={sendInput} onNeedName={askName} />
          )}
        </BottomSheet>
      )}

      {profile && (
        <ProfilePanel name={name} picks={Object.values(picks)} byId={byId} frames={v.frames}
          onClose={() => setProfile(false)} onSwitch={switchPerson} />
      )}

      {viewer && (
        <Viewer images={viewer.images} start={viewer.start} label={viewer.label} onSeen={onSeen} onClose={() => setViewer(null)} />
      )}
    </main>
  );
}

function TabButton({ label, active, onClick, badge = 0, dot = false, children }: {
  label: string; active: boolean; onClick: () => void; badge?: number; dot?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} aria-current={active ? "page" : undefined}
      className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${active ? "text-text" : "text-text-muted hover:text-text"}`}>
      <span className="relative">
        {children}
        {badge > 0 && (
          <span className={`absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${dot ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-[var(--surface-hover)] text-text"}`}>{badge}</span>
        )}
      </span>
      <span className="max-w-[80px] truncate">{label}</span>
      {active && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-[var(--brand)]" />}
    </button>
  );
}

/** A sheet that slides up over the page from the tab bar. Escape or the backdrop closes it. */
function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useBackToClose(onClose);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
      <div onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[80vh] w-full max-w-[560px] animate-fade-in flex-col overflow-hidden rounded-t-[20px] border border-b-0 border-[var(--border)] bg-surface pb-[env(safe-area-inset-bottom)]">
        <span aria-hidden className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-[var(--surface-hover)]" />
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 pb-3 pt-4">
          <p className="text-[15px] font-semibold">{title}</p>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted hover:bg-[var(--surface-hover)]"><X size={17} /></button>
        </div>
        <div className="overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}

/** Anything the client wants us to know that is not about one idea: offers, do's and don'ts, references. */
function InputsPanel({ name, inputs, onSend, onNeedName }: { name: string; inputs: Input[]; onSend: (t: string) => Promise<boolean>; onNeedName: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return onNeedName();
    setBusy(true); setDone(false);
    const ok = await onSend(text);
    setBusy(false);
    if (ok) { setText(""); setDone(true); }
  }
  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor="input-text" className="text-[13.5px] text-text-muted">
          Tell us anything that helps: an offer to push, what to show or avoid, your best seller, a reel you love (paste the link).
        </label>
        <textarea id="input-text" value={text} onChange={(e) => { setText(e.target.value); setDone(false); }} rows={4}
          placeholder="e.g. Push the Diwali gift box. Our kaju katli is the hero."
          className="rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[14.5px] outline-none placeholder:text-text-muted focus:border-[var(--brand-line)]" />
        <div className="flex items-center gap-3">
          <button disabled={busy || !text.trim()}
            className="flex h-11 items-center gap-2 rounded-soft bg-[var(--brand)] px-5 text-[14px] font-semibold text-[var(--brand-ink)] disabled:opacity-40">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send to BCON
          </button>
          {done && <span className="text-[13px] text-accent-green">Sent. The team has it.</span>}
          {!name && <span className="text-[12.5px] text-text-muted">Add your name first.</span>}
        </div>
      </form>
      {inputs.length > 0 && (
        <div>
          <p className="mb-1 text-[12px] font-medium uppercase tracking-[0.1em] text-text-muted">You sent</p>
          <ul className="flex flex-col">
            {inputs.map((i) => (
              <li key={i.id} className="border-t border-[var(--border)] py-2.5 first:border-t-0">
                <p className="whitespace-pre-wrap text-[14px]">{i.body}</p>
                <p className="mt-0.5 text-[11.5px] text-text-muted">{when(i.created_at)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The page ends where the order is: the four steps with the light beam on, then one quiet line. */
function SiteFooter({ brand, current }: { brand: string; current: number }) {
  return (
    <footer className="mx-auto mt-20 max-w-[1200px] px-4 lg:px-8">
      <div className="rounded-panel border border-[var(--border)] bg-surface px-4 py-6 sm:px-8">
        <p className="mb-5 text-[12px] font-medium uppercase tracking-[0.14em] text-text-muted">Your reel, step by step</p>
        <StepTimeline steps={STEPS} current={current} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 py-5 text-[11.5px] text-text-muted">
        <p>Private to {brand} · <a href="mailto:brands@bconclub.com" className="underline-offset-2 hover:underline">brands@bconclub.com</a></p>
        <p className="font-mono text-[11px]" title={`ARC v${VERSION}`}>ARC v{VERSION}</p>
      </div>
    </footer>
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

/** The client's own record: what they have sent to BCON and what is still a draft. */
function ProfilePanel({ name, picks, byId, frames, onClose, onSwitch }: {
  name: string; picks: Pick[]; byId: Map<string, Item>; frames: Item[]; onClose: () => void; onSwitch: () => void;
}) {
  useBackToClose(onClose);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const real = picks.filter((p) => p.choice || p.comment);
  const sent = real.filter((p) => p.sent_at).sort((a, b) => (b.sent_at || "").localeCompare(a.sent_at || ""));
  const drafts = real.filter((p) => !p.sent_at);
  const lastSent = sent[0]?.sent_at;
  const stillsOf = (id: string) => Array.from(byId.values()).filter((i) => i.kind === "image" && i.parent_id === id).slice(0, 4);
  const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  const Row = ({ p }: { p: Pick }) => {
    const it = byId.get(p.item_id);
    if (!it) return null;
    const what = it.kind === "idea" ? (p.choice === "like" ? "Chosen idea" : p.choice === "pass" ? "Not for us" : "Note on idea")
      : it.kind === "script" ? (p.comment ? "Change to the script" : "Script approved")
      : it.kind === "frame" ? `Change to frame ${frames.indexOf(it) + 1}` : "Pick";
    return (
      <li className="flex flex-col gap-2 border-t border-[var(--border)] py-3 first:border-t-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11.5px] font-medium text-text-muted">{what}</p>
            <p className="text-[15px] font-semibold leading-snug">{it.title || (it.kind === "frame" ? `Frame ${frames.indexOf(it) + 1}` : it.kind)}</p>
          </div>
          {p.choice === "like" && <span className="shrink-0 rounded-pill bg-[var(--brand-soft)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--brand-text)]">{it.kind === "idea" ? "Chosen" : "Approved"}</span>}
        </div>
        {it.kind === "idea" && stillsOf(it.id).length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {stillsOf(it.id).map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s.id} src={s.url || ""} alt="" className="aspect-[9/16] w-full rounded-soft object-cover" />
            ))}
          </div>
        )}
        {it.kind === "frame" && it.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={it.url} alt="" className="aspect-[9/16] w-20 rounded-soft object-cover" />
        )}
        {p.comment && <p className="rounded-soft bg-[var(--bg)] px-3 py-2 text-[13px] text-text-muted">&ldquo;{p.comment}&rdquo;</p>}
      </li>
    );
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Your picks" onClick={onClose} className="fixed inset-0 z-50 flex justify-end bg-black/60">
      <aside onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-[440px] flex-col overflow-hidden bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-[15px] font-bold text-[var(--brand-ink)]">{name.slice(0, 1).toUpperCase()}</span>
            <div>
              <p className="text-[15px] font-semibold">{name}</p>
              <p className={`text-[12.5px] ${lastSent ? "text-accent-green" : "text-text-muted"}`}>
                {lastSent ? `Sent to BCON · ${when(lastSent)}` : "Nothing sent to BCON yet"}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted hover:bg-[var(--surface-hover)]"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <h3 className="mb-1 text-[13px] font-semibold">Sent to BCON</h3>
          {sent.length ? <ul className="mb-6">{sent.map((p) => <Row key={p.item_id} p={p} />)}</ul>
            : <p className="mb-6 text-[13px] text-text-muted">When you press Send, your picks show up here.</p>}
          {drafts.length > 0 && (
            <>
              <h3 className="mb-1 text-[13px] font-semibold">Not sent yet</h3>
              <p className="mb-2 text-[12.5px] text-text-muted">These changes reach us when you press Send at the bottom.</p>
              <ul>{drafts.map((p) => <Row key={p.item_id} p={p} />)}</ul>
            </>
          )}
        </div>
        <div className="border-t border-[var(--border)] p-4">
          <button onClick={onSwitch} className="text-[13px] text-text-muted underline-offset-2 hover:text-text hover:underline">Not {name}? Switch name</button>
        </div>
      </aside>
    </div>
  );
}
