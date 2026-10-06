"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight, Check, ChevronLeft, Download, FolderOpen, Link2, Loader2, MessageSquareText, Pencil, Play, Radio, RotateCcw,
} from "lucide-react";
import { SegmentedTabs, type Tab } from "@/components/ui/SegmentedTabs";
import { StatusPill, type Tone } from "@/components/ui/StatusPill";
import { MasterDetail } from "@/components/ui/MasterDetail";

/**
 * Brand Reels: the team drops Instagram links, the Mac editor worker recreates
 * each one for the brand, and the cut comes back here for review. Approve it,
 * or send notes, which queues the next version on the same reel.
 */

type Output = {
  version: number; kind: string; name: string; path: string;
  size?: number; duration?: number; drive_url?: string;
  url?: string | null; download_url?: string | null;
};
type Reel = {
  id: string; ig_url: string; brand: string; note: string | null; title: string | null;
  status: string; stage: string | null; progress: number; version: number; feedback?: string | null;
  ref: { handle?: string; caption?: string; duration?: number; kind?: string; breakdown?: string; sheet?: string };
  outputs: Output[]; drive_folder_url: string | null; worker: string | null; error: string | null;
  code: string | null; posted_url: string | null; posted_at: string | null; final_url?: string | null;
  created_at: string; updated_at: string;
};
type Worker = { agent: string; last_seen: string; version: string | null; note: string | null; healthy: boolean };
type Event = { id: number; at: string; kind: string; note: string | null; actor: string | null };
type Detail = { reel: Reel; events: Event[]; outputs: Output[]; sheet: string | null };

const TONE: Record<string, Tone> = {
  queued: "neutral", processing: "info", review: "warn", changes: "warn",
  approved: "good", live: "brand", failed: "bad", cancelled: "neutral",
};
// "Sent" is what the team calls a cut that has been delivered for review.
const LABEL: Record<string, string> = {
  queued: "queued", processing: "making", review: "sent", changes: "changes asked",
  approved: "approved", live: "live", failed: "failed", cancelled: "cancelled",
};
const MAKING = ["queued", "processing"];
const FINISHED = ["review", "approved", "live"];
const STAGES = [
  { key: "download", label: "Download" },
  { key: "breakdown", label: "Break down" },
  { key: "assets", label: "Make assets" },
  { key: "motion", label: "Animate" },
  { key: "edit", label: "Edit" },
  { key: "upload", label: "Upload" },
];
const BRANDS: Tab<string>[] = [{ value: "BCON", label: "BCON" }, { value: "PROXe", label: "PROXe" }];
type View = "library" | "queue";
type LibFilter = "all" | "review" | "approved" | "live";

const IG_RE = /(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:reels?|p|tv)\/[A-Za-z0-9_-]+/gi;

function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}
const mb = (n?: number) => (n ? `${(n / 1e6).toFixed(1)} MB` : "");
const secs = (n?: number) => (n ? `${n.toFixed(1)}s` : "");
const shortcode = (url: string) => url.match(/\/(?:reel|p|tv)\/([^/]+)/)?.[1] ?? url;
const reelName = (r: Reel) => r.title || (r.ref.handle ? `@${r.ref.handle} ${shortcode(r.ig_url)}` : shortcode(r.ig_url));

function Panel({ title, sub, action, children, className = "" }: {
  title?: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col overflow-hidden rounded-panel border border-[var(--border)] bg-surface ${className}`}>
      {title && (
        <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-2 pt-3.5">
          <div className="min-w-0">
            <h2 className="text-[13.5px] font-semibold tracking-tight text-text">{title}</h2>
            {sub && <p className="mt-0.5 text-[11.5px] text-text-muted">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={`min-h-0 flex-1 px-4 pb-4 ${title ? "" : "pt-4"}`}>{children}</div>
    </section>
  );
}

/** Who last touched the queue. In pull mode an editor only checks in when it pulls or
 *  pushes, so "seen 2h ago" is normal, not an outage. */
function WorkerStatus({ workers }: { workers: Worker[] }) {
  const w = [...workers].sort((a, b) => b.last_seen.localeCompare(a.last_seen))[0];
  const fresh = w && Date.now() - new Date(w.last_seen).getTime() < 3 * 60_000;
  return (
    <div className="flex items-center gap-2 rounded-pill border border-[var(--border)] px-3 py-1.5 text-[12px]">
      <span className={`h-2 w-2 rounded-full ${fresh ? "bg-accent-green" : "bg-[var(--text-muted)] opacity-50"}`} />
      {w ? (
        <span className="text-text">
          {w.agent} <span className="text-text-muted">· {w.note || "idle"} · {ago(w.last_seen)}</span>
        </span>
      ) : (
        <span className="text-text-muted">No editor has pulled yet</span>
      )}
    </div>
  );
}

function Progress({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-1 overflow-hidden rounded-full bg-[var(--surface-hover)] ${className}`}>
      <div className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ width: `${Math.max(3, value)}%` }} />
    </div>
  );
}

function DropBar({ onQueued }: { onQueued: () => void }) {
  const [text, setText] = useState("");
  const [brand, setBrand] = useState("BCON");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const links = useMemo(() => Array.from(new Set(text.match(IG_RE) || [])), [text]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!links.length) {
      setMsg({ tone: "bad", text: "Paste an Instagram reel or post link, like instagram.com/reel/ABC123." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/ops/brand-reels", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: links, brand, note }),
      });
      const j = await r.json();
      if (j.created?.length) {
        setText(""); setNote("");
        setMsg({ tone: "good", text: `${j.created.length} reel${j.created.length > 1 ? "s" : ""} on the queue. The editor picks it up within a minute.` });
        onQueued();
      } else {
        setMsg({ tone: "bad", text: j.rejected?.[0]?.reason || j.error || "Could not queue that link. Try again." });
      }
    } catch {
      setMsg({ tone: "bad", text: "ARC did not answer. Check your connection and queue it again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex min-w-0 flex-1 items-center">
            <span className="sr-only">Instagram links</span>
            <Link2 size={16} className="pointer-events-none absolute left-3.5 text-text-muted" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={() => setMsg(null)}
              placeholder="Paste Instagram reel or post links, as many as you like"
              className="h-11 w-full rounded-soft border border-[var(--border)] bg-[var(--bg)] pl-10 pr-24 text-[14px] text-text outline-none transition-colors placeholder:text-text-muted focus:border-[var(--brand-line)]"
            />
            {links.length > 0 && (
              <span className="absolute right-3 rounded-pill bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--brand-text)]">
                {links.length} link{links.length > 1 ? "s" : ""}
              </span>
            )}
          </label>
          <SegmentedTabs tabs={BRANDS} value={brand} onChange={setBrand} size="sm" ariaLabel="Brand" />
          <button
            type="submit"
            disabled={busy}
            className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-soft bg-[var(--brand)] px-5 text-[13px] font-semibold text-[var(--brand-ink)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {busy ? "Queueing" : links.length > 1 ? `Queue ${links.length} reels` : "Queue reel"}
          </button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[11.5px] font-medium text-text-muted">Brief for the editor (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. use Evernuts packs, keep it under 15s, Hindi street signage"
            className="h-9 rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-text outline-none transition-colors placeholder:text-text-muted focus:border-[var(--brand-line)]"
          />
        </label>
        {msg && (
          <p role="status" className={`text-[12px] ${msg.tone === "good" ? "text-accent-green" : "text-accent-red"}`}>{msg.text}</p>
        )}
      </form>
    </Panel>
  );
}

function ReelRow({ r, active, onClick }: { r: Reel; active: boolean; onClick: () => void }) {
  const working = r.status === "processing";
  const stage = STAGES.find((s) => s.key === r.stage)?.label;
  return (
    <button
      onClick={onClick}
      className={`flex w-full flex-col gap-2 rounded-soft px-3 py-3 text-left transition-colors duration-150 ${
        active ? "bg-[var(--surface-hover)]" : "hover:bg-[var(--surface-hover)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate text-[13px] font-medium text-text">{reelName(r)}</span>
        <StatusPill status={LABEL[r.status] || r.status} tone={TONE[r.status]} />
      </div>
      {working && (
        <div className="flex items-center gap-2">
          <Progress value={r.progress} className="flex-1" />
          <span className="shrink-0 text-[11px] text-text-muted">{stage || "starting"}</span>
        </div>
      )}
      <div className="flex items-center gap-2 text-[11px] text-text-muted">
        <span className="font-semibold text-text">{r.brand}</span>
        <span>v{r.version}</span>
        <span>·</span>
        <span>{ago(r.updated_at)}</span>
      </div>
    </button>
  );
}

function Stepper({ reel }: { reel: Reel }) {
  const idx = STAGES.findIndex((s) => s.key === reel.stage);
  return (
    <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {STAGES.map((s, i) => {
        const done = idx > i;
        const now = idx === i;
        return (
          <li key={s.key} className="flex flex-col gap-1.5">
            <div className={`h-1 rounded-full ${done ? "bg-[var(--brand)]" : now ? "bg-[var(--brand-line)]" : "bg-[var(--surface-hover)]"}`}>
              {now && <div className="h-full animate-pulse rounded-full bg-[var(--brand)]" />}
            </div>
            <span className={`text-[11px] ${done || now ? "text-text" : "text-text-muted"}`}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ReviewBox({ reel, onDone }: { reel: Reel; onDone: () => void }) {
  const [mode, setMode] = useState<"idle" | "changes" | "live">("idle");
  const [feedback, setFeedback] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setErr(null);
    const r = await fetch(`/api/ops/brand-reels/${reel.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setErr(j.error || "That did not go through. Try again.");
    setMode("idle"); setFeedback(""); setPostUrl(""); onDone();
  }

  if (reel.status === "failed" || reel.status === "cancelled") {
    return (
      <div className="flex flex-col gap-3">
        {reel.error && (
          <p className="whitespace-pre-wrap rounded-soft bg-[rgba(255,68,68,0.08)] px-3 py-2 font-mono text-[11.5px] text-accent-red">{reel.error}</p>
        )}
        <button onClick={() => act("retry")} disabled={!!busy}
          className="flex h-10 items-center justify-center gap-2 self-start rounded-soft bg-[var(--brand)] px-4 text-[13px] font-semibold text-[var(--brand-ink)] disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Run v{reel.version} again
        </button>
        {err && <p className="text-[12px] text-accent-red">{err}</p>}
      </div>
    );
  }
  function liveForm() {
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor="post" className="text-[11.5px] font-medium text-text-muted">Link to the post (optional)</label>
        <input id="post" autoFocus value={postUrl} onChange={(e) => setPostUrl(e.target.value)} placeholder="https://www.instagram.com/reel/..."
          className="h-10 rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-text outline-none placeholder:text-text-muted focus:border-[var(--brand-line)]" />
        <div className="flex flex-wrap gap-2">
          <button onClick={() => act("live", { posted_url: postUrl })} disabled={!!busy}
            className="flex h-10 items-center gap-2 rounded-soft bg-[var(--brand)] px-4 text-[13px] font-semibold text-[var(--brand-ink)] disabled:opacity-50">
            {busy === "live" ? <Loader2 size={14} className="animate-spin" /> : <Radio size={15} />} Mark live
          </button>
          <button onClick={() => setMode("idle")} className="h-10 rounded-soft px-3 text-[13px] text-text-muted hover:text-text">Not yet</button>
        </div>
      </div>
    );
  }

  if (reel.status === "live") {
    return (
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-[13px] text-[var(--brand-text)]">
          <Radio size={15} /> Live{reel.posted_at ? ` since ${new Date(reel.posted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
        </p>
        {reel.posted_url ? (
          <a href={reel.posted_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 self-start text-[12.5px] text-text hover:underline">
            Open the post <ArrowUpRight size={12} />
          </a>
        ) : mode === "live" ? liveForm() : (
          <button onClick={() => setMode("live")} className="self-start text-[12px] text-text-muted underline-offset-2 hover:text-text hover:underline">Add the post link</button>
        )}
        {err && <p className="text-[12px] text-accent-red">{err}</p>}
      </div>
    );
  }
  if (reel.status === "approved") {
    return (
      <div className="flex flex-col gap-3">
        <p className="flex items-center gap-2 text-[13px] text-accent-green"><Check size={15} /> v{reel.version} approved. Ready to post.</p>
        {mode === "idle" && (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setMode("live")}
              className="flex h-10 items-center gap-2 rounded-soft bg-[var(--brand)] px-4 text-[13px] font-semibold text-[var(--brand-ink)]">
              <Radio size={15} /> Mark live
            </button>
            <button onClick={() => setMode("changes")} className="h-10 px-2 text-[12px] text-text-muted underline-offset-2 hover:text-text hover:underline">
              Reopen with changes
            </button>
          </div>
        )}
        {mode === "changes" && changesForm()}
        {mode === "live" && liveForm()}
        {err && <p className="text-[12px] text-accent-red">{err}</p>}
      </div>
    );
  }
  if (reel.status !== "review") return null;

  function changesForm() {
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor="fb" className="text-[11.5px] font-medium text-text-muted">What should change in v{reel.version + 1}?</label>
        <textarea
          id="fb" autoFocus rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)}
          placeholder="Be specific: which shot, what is wrong, what it should look like. e.g. 0:04 the pack logo warps, keep it sharp; end card line should say 'Your brand, off the billboard.'"
          className="rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] leading-relaxed text-text outline-none placeholder:text-text-muted focus:border-[var(--brand-line)]"
        />
        <div className="flex flex-wrap gap-2">
          <button onClick={() => act("changes", { feedback })} disabled={!!busy || !feedback.trim()}
            className="flex h-10 items-center gap-2 rounded-soft bg-[var(--brand)] px-4 text-[13px] font-semibold text-[var(--brand-ink)] disabled:opacity-40">
            {busy === "changes" && <Loader2 size={14} className="animate-spin" />} Send v{reel.version + 1} to the editor
          </button>
          <button onClick={() => { setMode("idle"); setFeedback(""); }}
            className="h-10 rounded-soft px-3 text-[13px] text-text-muted hover:text-text">Keep v{reel.version}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => act("approve")} disabled={!!busy}
            className="flex h-10 items-center gap-2 rounded-soft bg-[var(--brand)] px-4 text-[13px] font-semibold text-[var(--brand-ink)] disabled:opacity-50">
            {busy === "approve" ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />} Approve v{reel.version}
          </button>
          <button onClick={() => setMode("changes")}
            className="flex h-10 items-center gap-2 rounded-soft border border-[var(--border)] px-4 text-[13px] font-medium text-text hover:bg-[var(--surface-hover)]">
            <MessageSquareText size={15} /> Request changes
          </button>
        </div>
      ) : mode === "live" ? liveForm() : (
        changesForm()
      )}
      {err && <p className="text-[12px] text-accent-red">{err}</p>}
    </div>
  );
}

function Title({ reel, onSaved }: { reel: Reel; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(reelName(reel));
  useEffect(() => setValue(reelName(reel)), [reel]);
  async function save() {
    setEditing(false);
    if (!value.trim() || value.trim() === reelName(reel)) return setValue(reelName(reel));
    await fetch(`/api/ops/brand-reels/${reel.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rename", title: value }),
    });
    onSaved();
  }
  if (editing) {
    return (
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); setValue(reelName(reel)); } }}
        aria-label="Reel title"
        className="w-full rounded-soft border border-[var(--brand-line)] bg-[var(--bg)] px-2 py-1 text-[18px] font-semibold tracking-tight text-text outline-none" />
    );
  }
  return (
    <button onClick={() => setEditing(true)} title="Rename" className="group flex min-w-0 items-center gap-2 text-left">
      <h2 className="truncate text-[18px] font-semibold tracking-tight text-text">{reelName(reel)}</h2>
      <Pencil size={13} className="shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function ReelDetail({ id, onChanged, onBack }: { id: string; onChanged: () => void; onBack?: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [ver, setVer] = useState<number | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/ops/brand-reels/${id}`, { cache: "no-store" });
    if (r.ok) setD(await r.json());
  }, [id]);

  useEffect(() => { setD(null); setVer(null); load(); }, [load]);
  useEffect(() => {
    if (!d || !["queued", "processing"].includes(d.reel.status)) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [d, load]);

  if (!d) {
    return <Panel><div className="flex h-60 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={18} /></div></Panel>;
  }
  const { reel, events, outputs, sheet } = d;
  const versions = Array.from(new Set(outputs.map((o) => o.version))).sort((a, b) => b - a);
  const shown = ver ?? versions[0];
  const files = outputs.filter((o) => o.version === shown);
  const final = files.find((o) => o.kind === "final");
  const working = MAKING.includes(reel.status);
  const lastStage = events.find((e) => e.kind === "stage");
  const refresh = () => { load(); onChanged(); };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Panel>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {onBack && (
                <button onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-[12px] text-text-muted hover:text-text">
                  <ChevronLeft size={14} /> Library
                </button>
              )}
              <Title reel={reel} onSaved={refresh} />
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-muted">
                {reel.code && <span className="rounded-pill bg-[var(--surface-hover)] px-1.5 font-mono text-[11px] text-text">{reel.code}</span>}
                <span className="font-semibold text-text">{reel.brand}</span>
                <a href={reel.ig_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-text">
                  Original <ArrowUpRight size={12} />
                </a>
                {reel.drive_folder_url && (
                  <a href={reel.drive_folder_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-text">
                    <FolderOpen size={12} /> Drive folder
                  </a>
                )}
                <span>added {ago(reel.created_at)}</span>
              </div>
            </div>
            <StatusPill status={LABEL[reel.status] || reel.status} tone={TONE[reel.status]} />
          </div>

          {reel.note && <p className="text-[12.5px] text-text-muted"><span className="text-text">Brief:</span> {reel.note}</p>}
          {reel.feedback && working && (
            <p className="text-[12.5px] text-text-muted"><span className="text-text">Making v{reel.version} with:</span> {reel.feedback}</p>
          )}

          {working && (
            <div className="flex flex-col gap-3 rounded-soft bg-[var(--bg)] p-4">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-text">{reel.status === "queued" ? "Waiting for the editor" : `Making v${reel.version}`}</span>
                <span className="tabular-nums text-text-muted">{reel.progress}%</span>
              </div>
              <Stepper reel={reel} />
              {lastStage?.note && <p className="text-[11.5px] text-text-muted">{lastStage.note}</p>}
            </div>
          )}

          {final?.url ? (
            <div className="flex flex-col gap-4 lg:flex-row">
              <video key={final.url} src={final.url} controls playsInline
                className="mx-auto aspect-[9/16] max-h-[68vh] w-full max-w-[380px] shrink-0 rounded-soft bg-black object-contain" />
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                {versions.length > 1 && (
                  <SegmentedTabs size="sm" ariaLabel="Version" value={String(shown)} onChange={(v) => setVer(Number(v))}
                    tabs={versions.map((v) => ({ value: String(v), label: `v${v}` }))} className="self-start" />
                )}
                <ReviewBox reel={reel} onDone={refresh} />
                <div>
                  <h3 className="mb-1.5 text-[11.5px] font-medium text-text-muted">Files in v{shown}</h3>
                  <ul className="flex flex-col">
                    {files.map((f) => (
                      <li key={f.path} className="flex items-center gap-3 border-t border-[var(--border)] py-2 text-[12px]">
                        <span className="w-12 shrink-0 text-[10.5px] uppercase tracking-wide text-text-muted">{f.kind}</span>
                        <span className="min-w-0 flex-1 truncate text-text">{f.name}</span>
                        <span className="shrink-0 tabular-nums text-text-muted">{secs(f.duration)} {mb(f.size)}</span>
                        {f.download_url && (
                          <a href={f.download_url} aria-label={`Download ${f.name}`}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-soft text-text-muted hover:bg-[var(--surface-hover)] hover:text-text">
                            <Download size={14} />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            !working && <ReviewBox reel={reel} onDone={refresh} />
          )}
        </div>
      </Panel>

      {(sheet || reel.ref.breakdown) && (
        <Panel title="Reference" sub={reel.ref.handle ? `@${reel.ref.handle}${reel.ref.duration ? `, ${reel.ref.duration.toFixed(0)}s` : ""}` : undefined}
          action={reel.ref.breakdown ? (
            <button onClick={() => setShowBreakdown((v) => !v)} className="text-[12px] text-text-muted hover:text-text">
              {showBreakdown ? "Hide breakdown" : "Read breakdown"}
            </button>
          ) : undefined}>
          {sheet && <img src={sheet} alt="Frames from the original reel" className="w-full rounded-soft" />}
          {showBreakdown && reel.ref.breakdown && (
            <pre className="mt-3 max-h-[480px] overflow-auto whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-text">{reel.ref.breakdown}</pre>
          )}
        </Panel>
      )}

      <Panel title="History">
        <ul className="flex flex-col">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3 border-t border-[var(--border)] py-2 text-[12px] first:border-t-0">
              <span className="w-16 shrink-0 text-text-muted">{ago(e.at)}</span>
              <span className="min-w-0 flex-1 text-text">{e.note || e.kind}</span>
              <span className="shrink-0 text-text-muted">{e.actor}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function LibraryCard({ r, onOpen }: { r: Reel; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="group flex min-w-0 flex-col gap-2 text-left">
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-soft bg-[var(--bg)]">
        {r.final_url ? (
          // #t seeks past the first frame, which is often black, so the card shows a real still.
          <video src={`${r.final_url}#t=1.2`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-text-muted">no video yet</div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-150 group-hover:bg-black/30">
          <Play size={28} className="text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100" fill="currentColor" />
        </div>
        {/* Solid backing: a translucent tone pill alone disappears on a bright frame. */}
        <span className="absolute left-2 top-2 rounded-pill bg-black/70">
          <StatusPill status={LABEL[r.status] || r.status} tone={TONE[r.status]} />
        </span>
        {r.code && (
          <span className="absolute right-2 top-2 rounded-pill bg-black/60 px-1.5 py-0.5 font-mono text-[10.5px] text-white">{r.code}</span>
        )}
      </div>
      <div className="min-w-0 px-0.5">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-text">{reelName(r)}</p>
        <p className="mt-0.5 text-[11px] text-text-muted">
          <span className="font-semibold text-text">{r.brand}</span> · v{r.version} · {r.status === "live" && r.posted_at ? `live ${ago(r.posted_at)}` : ago(r.updated_at)}
        </p>
      </div>
    </button>
  );
}

export default function BrandReelsPage() {
  const [reels, setReels] = useState<Reel[] | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [view, setView] = useState<View>("library");
  const [lib, setLib] = useState<LibFilter>("all");
  const [sel, setSel] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/ops/brand-reels", { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    setReels(j.reels); setWorkers(j.workers);
  }, []);

  useEffect(() => { load(); }, [load]);
  const anyActive = !!reels?.some((r) => MAKING.includes(r.status));
  useEffect(() => {
    const t = setInterval(load, anyActive ? 5000 : 30000);
    return () => clearInterval(t);
  }, [load, anyActive]);

  const finished = useMemo(() => reels?.filter((r) => FINISHED.includes(r.status)) ?? [], [reels]);
  const queue = useMemo(() => reels?.filter((r) => !FINISHED.includes(r.status) && r.status !== "cancelled") ?? [], [reels]);
  const libCount = (f: LibFilter) => (f === "all" ? finished.length : finished.filter((r) => r.status === f).length);
  const libTabs: Tab<LibFilter>[] = [
    { value: "all", label: "All", count: libCount("all") },
    { value: "review", label: "Sent", count: libCount("review") },
    { value: "approved", label: "Approved", count: libCount("approved") },
    { value: "live", label: "Live", count: libCount("live") },
  ];
  const shown = lib === "all" ? finished : finished.filter((r) => r.status === lib);
  const viewTabs: Tab<View>[] = [
    { value: "library", label: "Library", count: finished.length },
    { value: "queue", label: "Queue", count: queue.length },
  ];

  // Queue view auto-opens the first job on desktop; the library opens on click only.
  useEffect(() => {
    if (view === "queue" && !sel && queue.length && window.matchMedia("(min-width: 1024px)").matches) setSel(queue[0].id);
  }, [view, queue, sel]);

  function switchView(v: View) { setView(v); setSel(null); }
  function onQueued() { load(); switchView("queue"); }

  return (
    <div className="mx-auto flex min-h-full max-w-[1400px] flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text">Brand Reels</h1>
          <p className="max-w-[62ch] text-[12.5px] text-text-muted">
            Drop a reel you like. The editor pulls it, breaks down its style, remakes it for the brand and sends it back here. Every cut lives in the library until it goes live.
          </p>
        </div>
        <WorkerStatus workers={workers} />
      </header>

      <DropBar onQueued={onQueued} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs tabs={viewTabs} value={view} onChange={switchView} ariaLabel="View" />
        {view === "library" && !sel && <SegmentedTabs tabs={libTabs} value={lib} onChange={setLib} size="sm" ariaLabel="Filter library" />}
      </div>

      {reels === null ? (
        <Panel><div className="flex h-60 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={18} /></div></Panel>
      ) : view === "library" ? (
        sel ? (
          <ReelDetail id={sel} onChanged={load} onBack={() => setSel(null)} />
        ) : shown.length === 0 ? (
          <Panel>
            <div className="flex flex-col items-center gap-1 px-4 py-14 text-center">
              <p className="text-[13px] text-text">{lib === "live" ? "Nothing live yet" : "No finished reels here"}</p>
              <p className="text-[12px] text-text-muted">
                {lib === "live" ? "Open an approved reel and mark it live once it is posted." : "Finished cuts land here as soon as the editor pushes them."}
              </p>
            </div>
          </Panel>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {shown.map((r) => <LibraryCard key={r.id} r={r} onOpen={() => setSel(r.id)} />)}
          </div>
        )
      ) : (
        <MasterDetail
          hasSelection={!!sel}
          onBack={() => setSel(null)}
          backLabel="Queue"
          list={
            <Panel className="flex-1">
              {queue.length === 0 ? (
                <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
                  <p className="text-[13px] text-text">Queue is clear</p>
                  <p className="text-[12px] text-text-muted">Paste an Instagram link above. It waits here until the editor pulls it.</p>
                </div>
              ) : (
                <div className="-mx-1 flex flex-col gap-0.5">
                  {queue.map((r) => <ReelRow key={r.id} r={r} active={r.id === sel} onClick={() => setSel(r.id)} />)}
                </div>
              )}
            </Panel>
          }
          detail={
            sel ? <ReelDetail id={sel} onChanged={load} /> : (
              <Panel>
                <div className="flex h-60 items-center justify-center text-[13px] text-text-muted">Pick a job to see where it is</div>
              </Panel>
            )
          }
        />
      )}
    </div>
  );
}
