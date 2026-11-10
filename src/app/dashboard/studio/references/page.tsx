"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, ExternalLink, Loader2, X } from "lucide-react";

/**
 * Reference library: template previews from other video tools, each one looked at and
 * rated. Only the ones rated 4 or 5 are kept, and each kept one carries our own prompt
 * to remake that look (plus a music prompt where the clip has sound, and the site's own
 * prompt where it publishes one). Every reference has a number (H0042, K0109) so a
 * brief can just say "use K0109". Open one by number with #K0109 in the address.
 *
 * The previews belong to the sites they came from: this page is for our own reference
 * and sits behind the login. The data lives in private storage, not in the repo.
 */

type Ref = {
  ref: string; source: string; name: string; group: string; kind: string; page: string;
  video: string; image: string; about: string; q: number | null; why: string;
  prompt: string; v: number; music: string; music_notes: string; theirs: string;
};

const PAGE = 120;

async function loadPart(part: "kept" | "skipped"): Promise<Ref[]> {
  const r = await fetch(`/api/ops/studio/refs?part=${part}`, { cache: "no-store" });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Could not load the library.");
  const { url } = await r.json();
  const f = await fetch(url);
  if (!f.ok) throw new Error("Could not load the library.");
  return f.json();
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}
      className="flex h-9 items-center gap-1.5 rounded-soft border border-[var(--border)] px-3 text-[12.5px] font-medium text-text hover:bg-[var(--surface-hover)]">
      {done ? <Check size={14} /> : <Copy size={14} />} {done ? "Copied" : label}
    </button>
  );
}

function Block({ title, text, copy }: { title: string; text: string; copy?: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[12px] font-semibold text-text">{title}</h3>
      <pre className="whitespace-pre-wrap break-words rounded-soft border border-[var(--border)] bg-[var(--bg)] p-3 font-sans text-[12.5px] leading-relaxed text-text">{text}</pre>
      {copy && <div><CopyButton text={text} label={copy} /></div>}
    </section>
  );
}

function Detail({ r, onClose }: { r: Ref; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label={r.ref}>
      <div className="relative grid w-full max-w-[1100px] grid-cols-1 gap-5 rounded-panel border border-[var(--border)] bg-surface p-4 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:p-5" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-soft bg-[var(--bg)] text-text hover:bg-[var(--surface-hover)]">
          <X size={16} />
        </button>
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-soft bg-black">
            {r.video ? (
              <video key={r.ref} src={r.video} poster={r.image || undefined} controls loop playsInline className="max-h-[70vh] w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.image} alt="" className="max-h-[70vh] w-full object-contain" />
            )}
          </div>
          {r.page && (
            <a href={r.page} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text">
              <ExternalLink size={13} /> Open on {r.source}
            </a>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4 pr-0 md:pr-8">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight text-text">{r.ref}</h2>
            <p className="text-[14px] font-medium text-text">{r.name}</p>
            <p className="text-[12px] text-text-muted">{r.source}{r.group ? ` · ${r.group}` : ""} · {r.kind === "video" ? "video" : "photo"}</p>
          </div>
          {r.q !== null && <p className="text-[12.5px] text-text-muted"><span className="text-text">Rated {r.q} of 5.</span> {r.why}</p>}
          {r.about && <p className="text-[12.5px] leading-relaxed text-text-muted">{r.about}</p>}
          {r.theirs && <Block title={`Their prompt (from ${r.source})`} text={r.theirs} copy="Copy their prompt" />}
          {r.prompt ? <Block title={`Our prompt, version ${r.v}`} text={r.prompt} copy="Copy prompt" /> : !r.theirs && <p className="text-[12.5px] text-text-muted">No prompt written for this one.</p>}
          {r.music && <Block title="Music prompt" text={r.music} copy="Copy music prompt" />}
          {r.music_notes && <Block title="Music notes (measured from the file, not heard)" text={r.music_notes} />}
        </div>
      </div>
    </div>
  );
}

const TABS = ["Best", "Videos", "Photos", "Rated 5", "Skipped"] as const;
type Tab = (typeof TABS)[number];

export default function ReferencesPage() {
  const [kept, setKept] = useState<Ref[] | null>(null);
  const [skipped, setSkipped] = useState<Ref[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Best");
  const [source, setSource] = useState("All sources");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { loadPart("kept").then(setKept).catch((e) => setErr(e.message)); }, []);
  useEffect(() => {
    if (tab === "Skipped" && !skipped) loadPart("skipped").then(setSkipped).catch((e) => setErr(e.message));
  }, [tab, skipped]);

  // #K0109 in the address opens that reference, so a number can be shared as a link.
  useEffect(() => {
    const read = () => setOpen(decodeURIComponent(window.location.hash.slice(1)).toUpperCase() || null);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    if (open && kept && !kept.some((r) => r.ref === open) && !skipped) loadPart("skipped").then(setSkipped).catch(() => {});
  }, [open, kept, skipped]);
  const close = useCallback(() => { history.replaceState(null, "", window.location.pathname); setOpen(null); }, []);

  const pool = tab === "Skipped" ? skipped : kept;
  const sources = useMemo(() => {
    const n = new Map<string, number>();
    for (const r of pool || []) n.set(r.source, (n.get(r.source) || 0) + 1);
    return Array.from(n.entries()).sort((a, b) => b[1] - a[1]);
  }, [pool]);
  const view = useMemo(() => {
    const s = query.trim().toLowerCase();
    return (pool || []).filter((r) =>
      (source === "All sources" || r.source === source) &&
      (tab === "Videos" ? r.kind === "video" : tab === "Photos" ? r.kind !== "video" : tab === "Rated 5" ? r.q === 5 : true) &&
      (!s || r.ref.toLowerCase().includes(s) || `${r.name} ${r.group} ${r.source} ${r.about} ${r.why}`.toLowerCase().includes(s)));
  }, [pool, source, tab, query]);
  useEffect(() => { setShown(PAGE); }, [tab, source, query]);

  const current = open ? (kept?.find((r) => r.ref === open) || skipped?.find((r) => r.ref === open) || null) : null;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-col gap-1">
        <Link href="/dashboard/studio" className="flex w-fit items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text"><ArrowLeft size={13} /> Studio</Link>
        <h1 className="text-[22px] font-bold tracking-tight text-text">References</h1>
        <p className="max-w-[70ch] text-[12.5px] text-text-muted">
          Template previews from other video tools, rated one by one. Only the strong ones are kept, each with our prompt to remake the look.
          Say a number in a brief, for example K0109, and open it here.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source"
          className="h-10 max-w-full rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-text outline-none focus:border-[var(--brand-line)]">
          <option>All sources</option>
          {sources.map(([s, n]) => <option key={s} value={s}>{s} ({n})</option>)}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by number or words, e.g. K0109 or watch" aria-label="Search references"
          className="h-10 min-w-0 flex-1 basis-56 rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-text outline-none placeholder:text-text-muted focus:border-[var(--brand-line)]" />
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t}
            className={`h-9 rounded-soft px-3 text-[12.5px] font-medium ${tab === t ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "border border-[var(--border)] text-text hover:bg-[var(--surface-hover)]"}`}>
            {t}
          </button>
        ))}
      </div>

      {err ? (
        <div className="rounded-panel border border-[var(--border)] bg-surface px-4 py-16 text-center text-[13px] text-text">{err}</div>
      ) : !pool ? (
        <div className="flex h-60 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={18} /></div>
      ) : (
        <>
          <p className="text-[12px] text-text-muted">{view.length.toLocaleString("en-GB")} reference{view.length === 1 ? "" : "s"}{tab === "Skipped" ? ". These were rated 3 or lower, or could not be opened." : ""}</p>
          {view.length === 0 ? (
            <div className="rounded-panel border border-[var(--border)] bg-surface px-4 py-16 text-center text-[13px] text-text-muted">Nothing matches. Clear the search or pick another source.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {view.slice(0, shown).map((r) => (
                <a key={r.ref} href={`#${r.ref}`}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-panel border border-[var(--border)] bg-surface transition-colors duration-150 hover:border-[var(--brand-line)]">
                  <div className="relative aspect-[3/4] overflow-hidden bg-black">
                    {r.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img loading="lazy" src={r.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <video preload="metadata" muted playsInline src={`${r.video}#t=0.5`} className="h-full w-full object-cover" />
                    )}
                    <span className="absolute left-2 top-2 rounded-soft bg-[var(--brand)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--brand-ink)]">{r.ref}</span>
                    {r.q === 5 && <span className="absolute right-2 top-2 rounded-soft bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">5</span>}
                  </div>
                  <div className="flex flex-col gap-0.5 p-2.5">
                    <p className="truncate text-[12.5px] font-medium text-text">{r.name}</p>
                    <p className="truncate text-[11px] text-text-muted">{r.source} · {r.kind === "video" ? "video" : "photo"}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
          {shown < view.length && (
            <button onClick={() => setShown((n) => n + PAGE)}
              className="mx-auto flex h-10 items-center rounded-soft border border-[var(--border)] px-4 text-[13px] font-medium text-text hover:bg-[var(--surface-hover)]">
              Show {Math.min(PAGE, view.length - shown)} more
            </button>
          )}
        </>
      )}

      {current && <Detail r={current} onClose={close} />}
    </div>
  );
}
