"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Star, Trash2 } from "lucide-react";
import { StatusPill, type Tone } from "@/components/ui/StatusPill";

/**
 * One product under review. Each ad shows its cuts (switch format and version),
 * the viewer's own 1 to 5 score, the team's average, and a comment thread. A
 * comment can be pinned to the moment the video is paused at.
 */

type File = { id: string; variant: string | null; fmt: string; kind: string; url: string | null };
type Comment = { id: string; file_id: string | null; reviewer: string; body: string; at: number | null; created_at: string };
type Ad = {
  id: string; code: string; title: string; group: string | null; note: string | null; status: string;
  files: File[]; ratings: { reviewer: string; rating: number }[]; comments: Comment[];
};
type Data = {
  brand: { slug: string; name: string; palette: string[] };
  product: { slug: string; name: string; notes: string | null; status: string };
  me: { name: string | null; owner: boolean };
  ads: Ad[];
};

const STATUS: Record<string, { label: string; tone: Tone }> = {
  review: { label: "To review", tone: "info" },
  waiting: { label: "Waiting on Z", tone: "warn" },
  blocked: { label: "Blocked", tone: "bad" },
  changes: { label: "Changes asked", tone: "warn" },
  approved: { label: "Approved", tone: "good" },
  live: { label: "Live", tone: "brand" },
};
const FMT_LABEL: Record<string, string> = { "9x16": "9:16", "4x5": "4:5", "1x1": "1:1" };
const NAME_KEY = "arc-review-name";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function Stars({ value, onPick, size = 18 }: { value: number; onPick?: (n: number | null) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center" onMouseLeave={() => setHover(0)} role={onPick ? "radiogroup" : undefined} aria-label="Score out of 5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onPick} aria-label={`${n} out of 5`} aria-checked={value === n} role={onPick ? "radio" : undefined}
          onMouseEnter={() => onPick && setHover(n)} onClick={() => onPick?.(value === n ? null : n)}
          className={`p-0.5 ${onPick ? "cursor-pointer" : "cursor-default"}`}>
          <Star size={size} strokeWidth={1.6}
            className={n <= shown ? "fill-[var(--brand)] text-[var(--brand)]" : "text-[var(--border-strong,var(--text-muted))]"} />
        </button>
      ))}
    </div>
  );
}

function AdCard({ ad, me, owner, onChanged, askName }: {
  ad: Ad; me: string | null; owner: boolean; onChanged: () => void; askName: () => string | null;
}) {
  const fmts = useMemo(() => Array.from(new Set(ad.files.map((f) => f.fmt))), [ad.files]);
  const variants = useMemo(() => Array.from(new Set(ad.files.map((f) => f.variant || ""))), [ad.files]);
  const [fmt, setFmt] = useState(fmts.includes("9x16") ? "9x16" : fmts[0]);
  const [variant, setVariant] = useState(variants[0]);
  const file = ad.files.find((f) => f.fmt === fmt && (f.variant || "") === variant)
    || ad.files.find((f) => f.fmt === fmt) || ad.files[0];
  const video = useRef<HTMLVideoElement>(null);
  const [text, setText] = useState("");
  const [pinTime, setPinTime] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mine = me ? ad.ratings.find((r) => r.reviewer === me)?.rating || 0 : 0;
  const avg = ad.ratings.length ? ad.ratings.reduce((n, r) => n + r.rating, 0) / ad.ratings.length : null;

  async function send(patch: Record<string, unknown>) {
    const name = me || askName();
    if (!name) return false;
    setBusy(true); setErr(null);
    const r = await fetch(`/api/ops/studio/review/ads/${ad.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ...patch }),
    });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || "Could not save. Try again."); return false; }
    onChanged();
    return true;
  }

  async function comment(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const t = video.current && pinTime && video.current.currentTime > 0 ? video.current.currentTime : undefined;
    if (await send({ comment: text, file_id: file?.id, at: t })) setText("");
  }

  async function remove(c: Comment) {
    const name = me || askName();
    await fetch(`/api/ops/studio/review/ads/${ad.id}?comment=${c.id}&name=${encodeURIComponent(name || "")}`, { method: "DELETE" });
    onChanged();
  }

  async function setStatus(status: string) {
    await fetch(`/api/ops/studio/review/ads/${ad.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    onChanged();
  }

  function seek(c: Comment) {
    const f = ad.files.find((x) => x.id === c.file_id);
    if (f && f !== file) { setFmt(f.fmt); setVariant(f.variant || ""); }
    setTimeout(() => { if (video.current && c.at !== null) { video.current.currentTime = c.at; video.current.play().catch(() => {}); } }, 50);
  }

  const st = STATUS[ad.status] || STATUS.review;
  const ratio = fmt === "4x5" ? "aspect-[4/5]" : fmt === "1x1" ? "aspect-square" : "aspect-[9/16]";

  return (
    <article className="grid min-w-0 grid-cols-1 gap-4 rounded-panel border border-[var(--border)] bg-surface p-4 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:p-5">
      <div className="flex min-w-0 flex-col gap-2">
        <div className={`relative mx-auto w-full max-w-[300px] overflow-hidden rounded-soft bg-black ${ratio}`}>
          {!file?.url ? (
            <div className="flex h-full items-center justify-center px-4 text-center text-[12px] text-white/60">File not uploaded yet</div>
          ) : file.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={file.url} alt={ad.title} className="h-full w-full object-contain" />
          ) : file.url.includes("drive.google.com") ? (
            <iframe src={file.url} title={ad.title} allow="autoplay" className="h-full w-full border-0" />
          ) : (
            <video key={file.id} ref={video} src={file.url} controls playsInline preload="metadata" className="h-full w-full object-contain" />
          )}
        </div>
        {(fmts.length > 1 || variants.length > 1) && (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {fmts.length > 1 && fmts.map((f) => (
              <button key={f} onClick={() => setFmt(f)}
                className={`h-8 rounded-soft px-3 text-[12px] font-medium ${f === fmt ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "border border-[var(--border)] text-text hover:bg-[var(--surface-hover)]"}`}>
                {FMT_LABEL[f] || f}
              </button>
            ))}
            {variants.length > 1 && variants.map((v) => (
              <button key={v || "main"} onClick={() => setVariant(v)}
                className={`h-8 rounded-soft px-3 text-[12px] font-medium ${v === variant ? "bg-[var(--surface-hover)] text-text ring-1 ring-[var(--brand-line)]" : "border border-[var(--border)] text-text-muted hover:text-text"}`}>
                {v || "Main"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11.5px] text-text-muted">{ad.code}</p>
            <h3 className="text-[16px] font-semibold tracking-tight text-text">{ad.title}</h3>
          </div>
          {owner ? (
            <select value={ad.status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"
              className="h-8 rounded-soft border border-[var(--border)] bg-[var(--bg)] px-2 text-[12px] text-text">
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          ) : <StatusPill status={st.label} tone={st.tone} />}
        </div>
        {ad.note && <p className="text-[12.5px] leading-relaxed text-text-muted">{ad.note}</p>}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-[var(--border)] py-3">
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-text-muted">Your score</span>
            <Stars value={mine} onPick={(n) => send({ rating: n })} />
          </div>
          <p className="text-[12px] text-text-muted">
            {avg === null ? "No scores yet" : <>Team <span className="font-semibold text-text">{avg.toFixed(1)}</span> from {ad.ratings.length}</>}
          </p>
          {ad.ratings.length > 0 && (
            <p className="text-[11.5px] text-text-muted">{ad.ratings.map((r) => `${r.reviewer} ${r.rating}`).join(" · ")}</p>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          {ad.comments.length === 0 && <p className="text-[12px] text-text-muted">No comments yet.</p>}
          {ad.comments.map((c) => {
            const f = ad.files.find((x) => x.id === c.file_id);
            return (
              <div key={c.id} className="group flex gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[11px] font-semibold text-text">
                  {c.reviewer.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] text-text-muted">
                    <span className="font-semibold text-text">{c.reviewer}</span> · {ago(c.created_at)}
                    {c.at !== null && (
                      <> · <button onClick={() => seek(c)} className="text-[var(--brand-text)] hover:underline">
                        {clock(c.at)}{f ? ` on ${FMT_LABEL[f.fmt] || f.fmt}${f.variant ? `, ${f.variant}` : ""}` : ""}
                      </button></>
                    )}
                  </p>
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text">{c.body}</p>
                </div>
                {(owner || c.reviewer === me) && (
                  <button onClick={() => remove(c)} aria-label="Remove comment"
                    className="h-7 w-7 shrink-0 rounded-soft text-text-muted opacity-0 hover:bg-[var(--surface-hover)] hover:text-text group-hover:opacity-100 focus:opacity-100">
                    <Trash2 size={13} className="mx-auto" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={comment} className="mt-auto flex flex-col gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="What works, what should change?"
            aria-label="Comment"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) comment(e as unknown as React.FormEvent); }}
            className="w-full resize-y rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] text-text outline-none placeholder:text-text-muted focus:border-[var(--brand-line)]" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {file?.kind === "video" && !file.url?.includes("drive.google.com") ? (
              <label className="flex items-center gap-2 text-[12px] text-text-muted">
                <input type="checkbox" checked={pinTime} onChange={(e) => setPinTime(e.target.checked)} />
                Pin to the moment the video is at
              </label>
            ) : <span />}
            <button disabled={busy || !text.trim()}
              className="flex h-9 items-center gap-2 rounded-soft bg-[var(--brand)] px-4 text-[13px] font-semibold text-[var(--brand-ink)] disabled:opacity-50">
              {busy && <Loader2 size={13} className="animate-spin" />} Comment
            </button>
          </div>
          {err && <p className="text-[12px] text-accent-red">{err}</p>}
        </form>
      </div>
    </article>
  );
}

export default function ReviewProduct({ params }: { params: { brand: string; product: string } }) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    const r = await fetch(`/api/ops/studio/review/${params.brand}/${params.product}`, { cache: "no-store" });
    if (!r.ok) return setErr(r.status === 404 ? "This product is not up for review." : "Could not load. Try again.");
    setData(await r.json());
  }, [params.brand, params.product]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { try { setName(localStorage.getItem(NAME_KEY)); } catch { /* private mode */ } }, []);

  const me = data?.me.name || name;
  const askName = () => {
    const n = window.prompt("Your name, so the team knows who said it")?.trim().slice(0, 40) || null;
    if (n) { setName(n); try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } }
    return n;
  };

  const groups = useMemo(() => {
    const out = new Map<string, Ad[]>();
    for (const a of data?.ads || []) {
      if (filter !== "all" && a.status !== filter) continue;
      const g = a.group || "Ads";
      out.set(g, [...(out.get(g) || []), a]);
    }
    return Array.from(out.entries());
  }, [data, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of data?.ads || []) c[a.status] = (c[a.status] || 0) + 1;
    return c;
  }, [data]);

  if (err) return <p className="p-6 text-[13px] text-text-muted">{err}</p>;
  if (!data) return <div className="flex h-80 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={18} /></div>;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5 p-4 lg:p-6">
      <header className="flex flex-col gap-2">
        <Link href={`/dashboard/studio/review/${data.brand.slug}`} className="flex w-fit items-center gap-1.5 text-[12.5px] text-text-muted hover:text-text">
          <ArrowLeft size={14} /> {data.brand.name}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-text">{data.product.name}</h1>
            {data.product.notes && <p className="max-w-[70ch] text-[12.5px] text-text-muted">{data.product.notes}</p>}
          </div>
          <p className="text-[12px] text-text-muted">
            {me ? <>Commenting as <span className="text-text">{me}</span>{!data.me.name && <> · <button onClick={askName} className="hover:underline">change</button></>}</>
              : <button onClick={askName} className="hover:underline">Set your name</button>}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[["all", `All ${data.ads.length}`], ...Object.entries(STATUS).filter(([k]) => counts[k]).map(([k, v]) => [k, `${v.label} ${counts[k]}`])].map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`h-8 rounded-pill px-3 text-[12px] ${filter === k ? "bg-[var(--surface-hover)] font-semibold text-text ring-1 ring-[var(--border)]" : "text-text-muted hover:text-text"}`}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {groups.length === 0 && <p className="text-[13px] text-text-muted">Nothing here.</p>}
      {groups.map(([g, ads]) => (
        <section key={g} className="flex flex-col gap-3">
          <h2 className="text-[13px] font-semibold text-text">{g}</h2>
          {ads.map((a) => <AdCard key={a.id} ad={a} me={me} owner={data.me.owner} onChanged={load} askName={askName} />)}
        </section>
      ))}
    </div>
  );
}
