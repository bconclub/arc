"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight, Check, ChevronLeft, Download, Eye, EyeOff, FolderOpen, Globe, Heart, ImagePlus, Link2, Loader2, Pin, RefreshCw, Trash2, X,
} from "lucide-react";
import { SegmentedTabs, type Tab } from "@/components/ui/SegmentedTabs";
import { StatusPill, type Tone } from "@/components/ui/StatusPill";
import { useLogoTone, logoTile } from "@/lib/use-logo-tone";

/**
 * One brand's studio. The top states what we are going after (mood, palette); the
 * composer is where the founder drops a request, an idea, a note or images; the
 * board shows everything the team and the editors have made for it.
 */

type Item = {
  position?: number | null;
  id: string; kind: "request" | "idea" | "image" | "note" | "script" | "frame" | "video"; title: string | null; body: string | null; status: string;
  image_path: string | null; url: string | null; source: string | null; prompt: string | null; tags: string[]; parent_id: string | null;
  created_by: string | null; assignee: string | null; pinned: boolean; created_at: string;
  hidden?: boolean; votes: Vote[];
};
type Vote = { voter: string; choice: "like" | "pass" | null; comment: string | null; updated_at: string };
type Reel = { id: string; title: string | null; code: string | null; status: string; version: number; posted_url: string | null; final_url: string | null };
type Brand = {
  id: string; slug: string; name: string; status: string; mood: string | null; palette: string[]; brief: string | null;
  site_url: string | null; instagram: string | null; drive_url: string | null; logo_url: string | null;
  share_enabled: boolean; share_token: string | null; share_intro: string | null;
  reel_length: string | null; changes_allowed: number; drafting?: string[];
};
type Activity = { id: number; at: string; kind: string; voter: string | null; item_id: string | null; session: string | null; meta: { text?: string; count?: number; ua?: string } };
type Data = { brand: Brand; items: Item[]; reels: Reel[]; activity: Activity[] };
type View = "board" | "reel" | "requests" | "ideas" | "images" | "picks" | "reels" | "brief";
type Kind = "request" | "idea" | "note" | "image" | "script" | "frame" | "video";

const ITEM_TONE: Record<string, Tone> = { open: "warn", doing: "info", done: "good", approved: "good", rejected: "bad", parked: "neutral" };
const KIND_LABEL: Record<string, string> = { request: "Request", idea: "Reel idea", note: "Note", script: "Script" };
const REEL_TONE: Record<string, Tone> = { queued: "neutral", processing: "info", review: "warn", approved: "good", live: "brand", failed: "bad" };
const REEL_LABEL: Record<string, string> = { review: "sent", processing: "making" };

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

async function patchItem(id: string, body: Record<string, unknown>) {
  await fetch(`/api/ops/studio/items/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

const field = "rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-text outline-none placeholder:text-text-muted focus:border-[var(--brand-line)]";

// ── Header: what we are going after ─────────────────────────────

function Editable({ value, placeholder, onSave, multiline, className = "" }: {
  value: string; placeholder: string; onSave: (v: string) => Promise<void>; multiline?: boolean; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  async function save() { setEditing(false); if (v.trim() !== value.trim()) await onSave(v); }
  if (editing) {
    return multiline ? (
      <textarea autoFocus rows={3} value={v} onChange={(e) => setV(e.target.value)} onBlur={save}
        onKeyDown={(e) => { if (e.key === "Escape") { setV(value); setEditing(false); } }}
        className={`w-full py-2 leading-relaxed ${field} ${className}`} />
    ) : (
      <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setV(value); setEditing(false); } }}
        className={`h-9 w-full ${field} ${className}`} />
    );
  }
  return (
    <button onClick={() => setEditing(true)} className={`w-full rounded-soft text-left transition-colors hover:bg-[var(--surface-hover)] ${className}`}>
      {value || <span className="text-text-muted">{placeholder}</span>}
    </button>
  );
}

function Header({ brand, onSaved }: { brand: Brand; onSaved: () => void }) {
  const [editLinks, setEditLinks] = useState(false);
  const [editPalette, setEditPalette] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const tone = useLogoTone(brand.logo_url);

  async function save(body: Record<string, unknown>) {
    await fetch(`/api/ops/studio/${brand.slug}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    onSaved();
  }
  /** One button: turns the client board on if it is off, then copies its link. */
  async function copyClientLink() {
    setSharing(true);
    const r = await fetch(`/api/ops/studio/${brand.slug}/share`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(brand.share_enabled ? {} : { enabled: true }),
    }).then((x) => x.json()).catch(() => null);
    setSharing(false);
    if (!r?.path) return;
    try { await navigator.clipboard.writeText(`${window.location.origin}${r.path}`); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
    if (!brand.share_enabled) onSaved();
  }
  const clientLink = brand.share_enabled && brand.share_token ? `/studio/${brand.slug}?k=${brand.share_token}` : null;

  const links = [
    brand.site_url && { href: brand.site_url, label: "Site", icon: Globe },
    brand.instagram && { href: brand.instagram.startsWith("http") ? brand.instagram : `https://instagram.com/${brand.instagram.replace(/^@/, "")}`, label: brand.instagram.startsWith("http") ? "Instagram" : brand.instagram, icon: ArrowUpRight },
    brand.drive_url && { href: brand.drive_url, label: "Drive", icon: FolderOpen },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Globe }[];

  return (
    <section className="flex flex-col gap-5 rounded-panel border border-[var(--border)] bg-[var(--bg)] p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/studio" className="inline-flex items-center gap-1 text-[12px] text-text-muted hover:text-text">
          <ChevronLeft size={14} /> Studio
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {clientLink && (
            <a href={clientLink} target="_blank" rel="noreferrer"
              className="flex h-9 items-center gap-1.5 rounded-soft border border-[var(--border)] px-3 text-[12.5px] text-text hover:bg-[var(--surface-hover)]">
              <ArrowUpRight size={14} /> Client view
            </a>
          )}
          <button onClick={copyClientLink} disabled={sharing}
            className="flex h-9 items-center gap-1.5 rounded-soft bg-[var(--brand)] px-3.5 text-[12.5px] font-semibold text-[var(--brand-ink)] disabled:opacity-50">
            {sharing ? <Loader2 size={14} className="animate-spin" /> : copied ? <Check size={14} /> : <Link2 size={14} />}
            {copied ? "Link copied" : brand.share_enabled ? "Copy client link" : "Share with client"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex items-center gap-4">
            {brand.logo_url && (
              // Logos arrive as full lockups (crest + wordmark), so the tile sizes to the
              // logo's width instead of cropping it into an icon square.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo_url} alt={`${brand.name} logo`} className={`h-20 w-auto max-w-[180px] shrink-0 rounded-soft object-contain p-1.5 ${logoTile(tone)}`} />
            )}
            <div className="min-w-0">
              <h1 className="truncate text-[28px] font-bold leading-tight tracking-tight text-text">{brand.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-text-muted">
                <select value={brand.status} onChange={(e) => save({ status: e.target.value })} aria-label="Brand status"
                  className="rounded-pill bg-[var(--surface-hover)] px-2.5 py-1 text-[11.5px] font-semibold capitalize text-text outline-none">
                  {["intake", "active", "paused", "archived"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {links.map((l) => (
                  <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-text">
                    <l.icon size={13} /> {l.label}
                  </a>
                ))}
                <select value={brand.reel_length || ""} onChange={(e) => save({ reel_length: e.target.value })} aria-label="Reel length"
                  className="rounded-pill bg-[var(--surface-hover)] px-2.5 py-1 text-[11.5px] font-semibold text-text outline-none">
                  <option value="">Reel length</option><option value="30s">30s reel</option><option value="60s">60s reel</option><option value="custom">Custom</option>
                </select>
                <select value={String(brand.changes_allowed)} onChange={(e) => save({ changes_allowed: Number(e.target.value) })} aria-label="Included changes"
                  className="rounded-pill bg-[var(--surface-hover)] px-2.5 py-1 text-[11.5px] font-semibold text-text outline-none">
                  {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n} changes</option>)}
                </select>
                <button onClick={() => setEditLinks((v) => !v)} className="text-[12px] underline-offset-2 hover:text-text hover:underline">
                  {editLinks ? "Done" : links.length ? "Edit links" : "Add links"}
                </button>
              </div>
            </div>
          </div>
          {editLinks && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {([["site_url", "Website", brand.site_url], ["instagram", "Instagram handle", brand.instagram], ["drive_url", "Drive folder link", brand.drive_url]] as const).map(([k, label, v]) => (
                <label key={k} className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-text-muted">{label}</span>
                  <input defaultValue={v || ""} onBlur={(e) => e.target.value.trim() !== (v || "") && save({ [k]: e.target.value })}
                    className={`h-9 ${field}`} />
                </label>
              ))}
            </div>
          )}
          <div>
            <p className="mb-1 text-[11px] font-medium text-text-muted">Mood we are going after</p>
            <Editable value={brand.mood || ""} placeholder="Click to set the mood, e.g. warm festive gold, real pieces in real light" multiline
              onSave={(v) => save({ mood: v })} className="px-1 py-1 text-[16px] leading-snug text-text" />
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 lg:w-[320px]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-text-muted">Palette</p>
            <button onClick={() => setEditPalette((v) => !v)} className="text-[11.5px] text-text-muted underline-offset-2 hover:text-text hover:underline">
              {editPalette ? "Done" : "Edit"}
            </button>
          </div>
          <div className="flex h-20 overflow-hidden rounded-soft border border-[var(--border)]">
            {brand.palette.length ? brand.palette.map((c) => (
              <div key={c} className="flex flex-1 items-end p-1.5" style={{ background: c }}>
                <span className="rounded bg-black/50 px-1 font-mono text-[9.5px] text-white">{c}</span>
              </div>
            )) : <div className="flex flex-1 items-center justify-center text-[11px] text-text-muted">No colours yet</div>}
          </div>
          {editPalette && (
            <input autoFocus defaultValue={brand.palette.join(" ")} aria-label="Palette hex colours" placeholder="#47704C #B8892E"
              onBlur={(e) => { save({ palette: e.target.value }); setEditPalette(false); }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className={`h-9 font-mono ${field}`} />
          )}
        </div>
      </div>
    </section>
  );
}

// ── Client sharing (admin only) ─────────────────────────────────

const likes = (i: Item) => i.votes.filter((v) => v.choice === "like").length;
const passes = (i: Item) => i.votes.filter((v) => v.choice === "pass").length;
const notesOf = (i: Item) => i.votes.filter((v) => v.comment);

function VoteLine({ item }: { item: Item }) {
  if (!item.votes.length) return null;
  return (
    <div className="flex flex-col gap-1 rounded-soft bg-[var(--surface-hover)] px-2.5 py-2 text-[11.5px]">
      <span className="text-text">
        <Heart size={11} className="mr-1 inline text-[var(--brand-text)]" fill="currentColor" />{likes(item)} love{likes(item) === 1 ? "s" : ""} it
        {passes(item) > 0 && <span className="text-text-muted"> · {passes(item)} not for us</span>}
        <span className="text-text-muted"> · {item.votes.map((v) => v.voter).join(", ")}</span>
      </span>
      {notesOf(item).map((v) => <span key={v.voter} className="text-text-muted"><span className="text-text">{v.voter}:</span> {v.comment}</span>)}
    </div>
  );
}

function SharePanel({ brand, items, activity, onChanged }: { brand: Brand; items: Item[]; activity: Activity[]; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const shown = items.filter((i) => (i.kind === "idea" || i.kind === "image") && !i.hidden && i.status !== "rejected" && i.status !== "parked").length;
  const voters = new Set(items.flatMap((i) => i.votes.map((v) => v.voter))).size;

  async function share(body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/ops/studio/${brand.slug}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false); onChanged();
  }

  return (
    <section className="flex flex-col gap-3 rounded-panel border border-[var(--border)] bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[13.5px] font-semibold text-text"><Link2 size={14} /> Client board</h2>
          <p className="mt-0.5 text-[11.5px] text-text-muted">
            {brand.share_enabled
              ? `Live. The client sees the mood, palette and ${shown} ideas and images. Requests, notes and hidden items stay here.`
              : "Off. Turn it on to send the client a link where they pick the ideas and looks they like."}
            {voters > 0 && <span className="text-text"> {voters} {voters === 1 ? "person has" : "people have"} sent picks.</span>}
            {!!brand.drafting?.length && <span className="text-text-muted"> {brand.drafting.join(", ")} {brand.drafting.length === 1 ? "is" : "are"} picking, not sent yet.</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {brand.share_enabled && (
            <>
              <button onClick={() => share({ rotate: true })} disabled={busy} title="The old link stops working"
                className="flex h-9 items-center gap-1.5 rounded-soft px-2 text-[12.5px] text-text-muted hover:text-text disabled:opacity-50">
                <RefreshCw size={13} /> New link
              </button>
            </>
          )}
          <button onClick={() => share({ enabled: !brand.share_enabled })} disabled={busy} role="switch" aria-checked={brand.share_enabled}
            className={`flex h-9 items-center gap-2 rounded-soft border px-3 text-[12.5px] font-medium disabled:opacity-50 ${brand.share_enabled ? "border-[var(--border)] text-text hover:bg-[var(--surface-hover)]" : "border-[var(--brand-line)] text-[var(--brand-text)] hover:bg-[var(--brand-faint)]"}`}>
            {busy && <Loader2 size={13} className="animate-spin" />}
            {brand.share_enabled ? "Turn off link" : "Turn on"}
          </button>
        </div>
      </div>
      {(brand.share_enabled || activity.length > 0) && (
        <div className="rounded-soft bg-[var(--bg)] p-3">
          <p className="mb-1.5 text-[11px] font-medium text-text-muted">Client activity</p>
          <ActivityFeed activity={activity} items={items} />
        </div>
      )}
      {brand.share_enabled && (
        <div>
          <p className="mb-1 text-[11px] font-medium text-text-muted">Message at the top of their board</p>
          <Editable value={brand.share_intro || ""} multiline
            placeholder="Optional. e.g. Hi team, here is where we want to take Velqine this festive season. Tap what you love."
            onSave={(v) => share({ intro: v })} className="px-1 py-1 text-[13px] leading-relaxed text-text" />
        </div>
      )}
    </section>
  );
}

// ── Client activity: everything they do on their link ──────────

const ACT_VERB: Record<string, string> = {
  open: "opened the link", name: "entered their name", view: "looked at", choose: "said yes to", unchoose: "took back their answer on",
  pass: "said nope to", note: "left a note on", tray: "reviewed their picks", send: "sent their picks to BCON",
  input: "sent inputs",
};

function ActivityFeed({ activity, items }: { activity: Activity[]; items: Item[] }) {
  const [all, setAll] = useState(false);
  const byId = new Map(items.map((i) => [i.id, i]));
  const label = (a: Activity) => {
    const it = a.item_id ? byId.get(a.item_id) : null;
    const parent = it?.parent_id ? byId.get(it.parent_id) : null;
    const what = it ? (it.kind === "image" && parent ? `a still of "${parent.title}"` : `"${it.title || it.kind}"`) : "";
    return `${ACT_VERB[a.kind] || a.kind}${what ? ` ${what}` : ""}${(a.kind === "note" || a.kind === "input") && a.meta?.text ? `: "${a.meta.text}"` : ""}`;
  };
  if (!activity.length) return <p className="text-[12px] text-text-muted">No client activity yet. Every open, view, choice, note and send on their link shows up here.</p>;
  const visits = new Set(activity.filter((a) => a.kind === "open").map((a) => a.session)).size;
  const list = all ? activity : activity.slice(0, 8);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11.5px] text-text-muted">
        Last seen {ago(activity[0].at)}{activity[0].voter ? ` (${activity[0].voter})` : ""} · {visits} visit{visits === 1 ? "" : "s"}
      </p>
      <ul className="flex flex-col">
        {list.map((a) => (
          <li key={a.id} className="flex gap-3 border-t border-[var(--border)] py-1.5 text-[12px] first:border-t-0">
            <span className="w-14 shrink-0 text-text-muted">{ago(a.at)}</span>
            <span className={`min-w-0 flex-1 ${a.kind === "send" || a.kind === "choose" ? "text-text" : "text-text-muted"}`}>
              <span className="font-medium text-text">{a.voter || "Someone"}</span> {label(a)}
            </span>
          </li>
        ))}
      </ul>
      {activity.length > 8 && (
        <button onClick={() => setAll((v) => !v)} className="self-start text-[11.5px] text-text-muted underline-offset-2 hover:text-text hover:underline">
          {all ? "Show less" : `Show all ${activity.length}`}
        </button>
      )}
    </div>
  );
}

// ── Composer: drop a request, idea, note or images ─────────────

function Composer({ slug, ideas, existingFrames, onAdded }: { slug: string; ideas: Item[]; existingFrames: (ideaId: string) => number; onAdded: () => void }) {
  const [forIdea, setForIdea] = useState("");
  const [kind, setKind] = useState<Kind>("request");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const tabs: Tab<Kind>[] = [
    { value: "request", label: "Request" }, { value: "idea", label: "Reel idea" }, { value: "image", label: "Images" },
    { value: "script", label: "Script" }, { value: "frame", label: "Board frames" }, { value: "video", label: "Final reel" },
    { value: "note", label: "Note" },
  ];
  const [captions, setCaptions] = useState("");
  const needsIdea = kind === "script" || kind === "frame" || kind === "video";
  const hint: Record<Kind, string> = {
    request: "What should the editors make? e.g. 6 festive stills of the ruby jhumka on a model, warm Diwali light",
    idea: "A reel idea the client can choose. One or two lines: the hook, what happens, why it sells. e.g. The jhumka sways in slow macro, each swing timed to temple bells, price lands on the last beat.",
    script: "The full script. One beat per line: VISUAL / VO / ON-SCREEN text.",
    frame: "",
    video: "",
    note: "A decision or finding. e.g. client confirmed: no lifetime-guarantee claim",
    image: "",
  };

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      if (needsIdea && !forIdea) throw new Error("Choose which reel idea this belongs to.");
      const upload = async (f: File) => {
        const u = await fetch(`/api/ops/studio/${slug}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ upload: f.name }) }).then((r) => r.json());
        if (!u.signedUrl) throw new Error(u.error || "Upload link failed.");
        const put = await fetch(u.signedUrl, { method: "PUT", headers: { "Content-Type": f.type || "application/octet-stream" }, body: f });
        if (!put.ok) throw new Error(`Upload of ${f.name} failed.`);
        return u.path as string;
      };
      const create = (b: Record<string, unknown>) => fetch(`/api/ops/studio/${slug}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
      if (kind === "frame") {
        if (!files.length) throw new Error("Choose the frame images, in order.");
        const lines = captions.split(/\r?\n/);
        const start = existingFrames(forIdea);
        const ordered = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        for (let i = 0; i < ordered.length; i++) {
          const path = await upload(ordered[i]);
          await create({ kind: "frame", parent_id: forIdea, image_path: path, position: start + i + 1, title: `Frame ${start + i + 1}`, body: (lines[i] || "").trim() });
        }
      } else if (kind === "video") {
        if (!files[0]) throw new Error("Choose the final reel video.");
        const path = await upload(files[0]);
        await create({ kind: "video", parent_id: forIdea, image_path: path, title: title || "Final reel" });
      } else if (kind === "script") {
        if (!body.trim()) throw new Error("Paste the script first.");
        const r = await create({ kind: "script", parent_id: forIdea, title: title || "Script", body });
        if (!r.ok) throw new Error((await r.json()).error || "Could not add it.");
      } else if (kind === "image") {
        if (!files.length) throw new Error("Pick one or more images first.");
        for (const f of files) {
          const u = await fetch(`/api/ops/studio/${slug}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ upload: f.name }) }).then((r) => r.json());
          if (!u.signedUrl) throw new Error(u.error || "Upload link failed.");
          const put = await fetch(u.signedUrl, { method: "PUT", headers: { "Content-Type": f.type || "image/jpeg" }, body: f });
          if (!put.ok) throw new Error(`Upload of ${f.name} failed.`);
          await fetch(`/api/ops/studio/${slug}/items`, { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: "image", image_path: u.path, title: title || f.name.replace(/\.[^.]+$/, ""), prompt, source: prompt ? "gpt" : "upload", ...(forIdea ? { parent_id: forIdea } : {}) }) });
        }
      } else {
        const r = await fetch(`/api/ops/studio/${slug}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, title, body }) });
        if (!r.ok) throw new Error((await r.json()).error || "Could not add it.");
      }
      setTitle(""); setBody(""); setPrompt(""); setFiles([]); setCaptions("");
      if (fileRef.current) fileRef.current.value = "";
      onAdded();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="flex flex-col gap-3 rounded-panel border border-[var(--border)] bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedTabs tabs={tabs} value={kind} onChange={setKind} size="sm" ariaLabel="What are you adding" />
        {kind === "request" && <span className="text-[11.5px] text-text-muted">Requests go to the editors&apos; inbox.</span>}
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title"
        placeholder={kind === "image" ? "Title for these images (optional)" : "Short title"} className={`h-10 ${field}`} />
      {needsIdea && (
        <label className="flex flex-col gap-1">
          <span className="text-[11.5px] font-medium text-text-muted">For which reel idea (the one the client chose)</span>
          <select value={forIdea} onChange={(e) => setForIdea(e.target.value)} className={`h-10 ${field}`}>
            <option value="">Choose the idea</option>
            {ideas.map((i) => <option key={i.id} value={i.id}>{i.title || "Untitled idea"}{likes(i) ? ` (client chose it)` : ""}</option>)}
          </select>
        </label>
      )}
      {kind === "frame" ? (
        <>
          <label className="flex cursor-pointer items-center gap-3 rounded-soft border border-dashed border-[var(--border)] px-4 py-4 text-[13px] text-text-muted hover:border-[var(--brand-line)] hover:text-text">
            <ImagePlus size={18} />
            {files.length ? `${files.length} frame${files.length > 1 ? "s" : ""} ready (ordered by file name)` : "Choose the board frames (9:16 stills), named in order: 01.png, 02.png..."}
            <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
          </label>
          <textarea rows={4} value={captions} onChange={(e) => setCaptions(e.target.value)} aria-label="Frame captions"
            placeholder={"One line per frame, same order: what happens / VO / on-screen text\ne.g. Close-up, jhumka catches the diya light. VO: Every festival has its sound."}
            className={`py-2 leading-relaxed ${field}`} />
        </>
      ) : kind === "video" ? (
        <label className="flex cursor-pointer items-center gap-3 rounded-soft border border-dashed border-[var(--border)] px-4 py-4 text-[13px] text-text-muted hover:border-[var(--brand-line)] hover:text-text">
          <ImagePlus size={18} />
          {files[0] ? files[0].name : "Choose the final reel (mp4)"}
          <input ref={fileRef} type="file" accept="video/*" className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 1))} />
        </label>
      ) : kind === "image" ? (
        <>
          <label className="flex cursor-pointer items-center gap-3 rounded-soft border border-dashed border-[var(--border)] px-4 py-4 text-[13px] text-text-muted hover:border-[var(--brand-line)] hover:text-text">
            <ImagePlus size={18} />
            {files.length ? `${files.length} image${files.length > 1 ? "s" : ""} ready` : "Choose images (stills from GPT, refs, screenshots)"}
            <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-text-muted">Show these as stills of a reel idea (the client sees them next to the idea)</span>
            <select value={forIdea} onChange={(e) => setForIdea(e.target.value)} className={`h-10 ${field}`}>
              <option value="">No, reference only (header collage)</option>
              {ideas.map((i) => <option key={i.id} value={i.id}>Stills for: {i.title || "Untitled idea"}</option>)}
            </select>
          </label>
          <textarea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Prompt used"
            placeholder="The prompt that made them (optional, so we can make more like it)" className={`py-2 ${field}`} />
        </>
      ) : (
        <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Details" placeholder={hint[kind]} className={`py-2 leading-relaxed ${field}`} />
      )}
      <div className="flex items-center gap-3">
        <button disabled={busy} className="flex h-10 items-center gap-2 rounded-soft bg-[var(--brand)] px-4 text-[13px] font-semibold text-[var(--brand-ink)] disabled:opacity-50">
          {busy && <Loader2 size={14} className="animate-spin" />}
          {kind === "request" ? "Send request" : kind === "image" ? "Add to board" : kind === "frame" ? "Add frames" : kind === "video" ? "Upload final reel" : kind === "idea" ? "Add reel idea" : `Add ${kind}`}
        </button>
        {err && <p className="text-[12px] text-accent-red">{err}</p>}
      </div>
    </form>
  );
}

// ── Board pieces ────────────────────────────────────────────────

function TextCard({ item, options = [], onOpen, onChanged }: { item: Item; options?: Item[]; onOpen?: (i: Item) => void; onChanged: () => void }) {
  const set = async (b: Record<string, unknown>) => { await patchItem(item.id, b); onChanged(); };
  const remove = async () => { await fetch(`/api/ops/studio/items/${item.id}`, { method: "DELETE" }); onChanged(); };
  return (
    <article className="group flex flex-col gap-2 rounded-soft border border-[var(--border)] bg-[var(--bg)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10.5px] font-medium uppercase tracking-wide text-text-muted">{KIND_LABEL[item.kind]}</p>
          {item.title && <h3 className="text-[13.5px] font-semibold leading-snug text-text">{item.title}</h3>}
        </div>
        {item.kind !== "note" && <StatusPill status={item.status} tone={ITEM_TONE[item.status]} />}
      </div>
      {item.body && <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-text-muted">{item.body}</p>}
      {item.kind === "idea" && (options.length ? (
        <div className="grid grid-cols-4 gap-1.5">
          {options.map((o, j) => (
            <button key={o.id} onClick={() => onOpen?.(o)} className="relative overflow-hidden rounded-soft" title={o.title || ""}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.url || ""} alt="" className={`aspect-[4/5] w-full object-cover ${o.hidden ? "opacity-40" : ""}`} />
              <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px] font-semibold text-white">{"ABCDEFGH"[j]}</span>
              {likes(o) > 0 && <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded-pill bg-[var(--brand)] px-1 text-[10px] font-semibold text-[var(--brand-ink)]"><Heart size={9} fill="currentColor" />{likes(o)}</span>}
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-soft border border-dashed border-[var(--border)] px-2 py-2 text-[11.5px] text-text-muted">No stills yet. Add 1 to 6 with &quot;Stills for: {item.title}&quot; so the client can see the idea.</p>
      ))}
      <VoteLine item={item} />
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
        <span>{item.created_by === "team" ? "team" : item.created_by} · {ago(item.created_at)}{item.assignee ? ` · ${item.assignee} on it` : ""}</span>
        <span className="flex-1" />
        {item.kind === "request" && item.status !== "done" && (
          <button onClick={() => set({ status: "done" })} className="rounded-pill px-2 py-1 hover:bg-[var(--surface-hover)] hover:text-text">Mark done</button>
        )}
        {item.kind === "request" && item.status === "done" && (
          <button onClick={() => set({ status: "open" })} className="rounded-pill px-2 py-1 hover:bg-[var(--surface-hover)] hover:text-text">Reopen</button>
        )}
        {item.kind === "idea" && item.status !== "approved" && (
          <button onClick={() => set({ status: "approved" })} className="rounded-pill px-2 py-1 hover:bg-[var(--surface-hover)] hover:text-text">Approve</button>
        )}
        {item.kind === "idea" && item.status !== "parked" && (
          <button onClick={() => set({ status: "parked" })} className="rounded-pill px-2 py-1 hover:bg-[var(--surface-hover)] hover:text-text">Park</button>
        )}
        {item.kind === "idea" && (
          <button onClick={() => set({ hidden: !item.hidden })} title={item.hidden ? "Hidden from the client board" : "Shown on the client board"}
            className={`flex items-center gap-1 rounded-pill px-2 py-1 hover:bg-[var(--surface-hover)] hover:text-text ${item.hidden ? "text-accent-orange" : ""}`}>
            {item.hidden ? <EyeOff size={12} /> : <Eye size={12} />} {item.hidden ? "Hidden" : "Client sees"}
          </button>
        )}
        <button onClick={remove} aria-label="Delete" className="rounded-pill p-1 opacity-0 transition-opacity hover:bg-[var(--surface-hover)] hover:text-accent-red group-hover:opacity-100 focus:opacity-100">
          <Trash2 size={13} />
        </button>
      </div>
    </article>
  );
}

function Lightbox({ item, onClose, onChanged }: { item: Item; onClose: () => void; onChanged: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const set = async (b: Record<string, unknown>) => { await patchItem(item.id, b); onChanged(); };
  const remove = async () => { await fetch(`/api/ops/studio/items/${item.id}`, { method: "DELETE" }); onChanged(); onClose(); };
  return (
    <div role="dialog" aria-modal="true" aria-label={item.title || "Image"} onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-panel bg-surface lg:flex-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url || ""} alt={item.title || ""} className="max-h-[70vh] min-w-0 flex-1 bg-black object-contain lg:max-h-[86vh]" />
        <div className="flex w-full shrink-0 flex-col gap-3 overflow-auto p-4 lg:w-[320px]">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] font-semibold text-text">{item.title || "Untitled"}</h3>
            <button onClick={onClose} aria-label="Close" className="rounded-pill p-1 text-text-muted hover:bg-[var(--surface-hover)] hover:text-text"><X size={16} /></button>
          </div>
          <p className="text-[11.5px] text-text-muted">{item.source || "upload"} · {item.created_by} · {ago(item.created_at)}</p>
          {item.prompt && (
            <div>
              <p className="mb-1 text-[11px] font-medium text-text-muted">Prompt</p>
              <p className="whitespace-pre-wrap rounded-soft bg-[var(--bg)] p-2 text-[12px] leading-relaxed text-text">{item.prompt}</p>
            </div>
          )}
          {item.body && <p className="whitespace-pre-wrap text-[12.5px] text-text-muted">{item.body}</p>}
          <VoteLine item={item} />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => set({ status: item.status === "approved" ? "open" : "approved" })}
              className={`flex h-9 items-center gap-1.5 rounded-soft px-3 text-[12.5px] font-semibold ${item.status === "approved" ? "bg-[rgba(0,212,170,0.14)] text-accent-green" : "bg-[var(--brand)] text-[var(--brand-ink)]"}`}>
              <Check size={14} /> {item.status === "approved" ? "Approved" : "Approve"}
            </button>
            <button onClick={() => set({ pinned: !item.pinned })}
              className="flex h-9 items-center gap-1.5 rounded-soft border border-[var(--border)] px-3 text-[12.5px] text-text hover:bg-[var(--surface-hover)]">
              <Pin size={14} /> {item.pinned ? "Unpin cover" : "Use as cover"}
            </button>
            {item.url && (
              <a href={item.url} download className="flex h-9 items-center gap-1.5 rounded-soft border border-[var(--border)] px-3 text-[12.5px] text-text hover:bg-[var(--surface-hover)]">
                <Download size={14} /> Open full size
              </a>
            )}
            <button onClick={() => set({ hidden: !item.hidden })}
              className={`flex h-9 items-center gap-1.5 rounded-soft border border-[var(--border)] px-3 text-[12.5px] hover:bg-[var(--surface-hover)] ${item.hidden ? "text-accent-orange" : "text-text"}`}>
              {item.hidden ? <EyeOff size={14} /> : <Eye size={14} />} {item.hidden ? "Hidden from client" : "Hide from client"}
            </button>
            <button onClick={remove} className="flex h-9 items-center gap-1.5 rounded-soft px-3 text-[12.5px] text-text-muted hover:text-accent-red">
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImageGrid({ images, onOpen }: { images: Item[]; onOpen: (i: Item) => void }) {
  if (!images.length) return <p className="py-10 text-center text-[12.5px] text-text-muted">No images yet. Add stills from GPT or references above.</p>;
  return (
    <div className="columns-2 gap-3 sm:columns-3 xl:columns-4">
      {images.map((i) => (
        <button key={i.id} onClick={() => onOpen(i)} className="group relative mb-3 block w-full overflow-hidden rounded-soft bg-[var(--bg)] text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={i.url || ""} alt={i.title || ""} loading="lazy" className={`w-full ${i.hidden ? "opacity-40" : ""}`} />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <span className="truncate text-[11.5px] text-white">{i.title}</span>
          </div>
          <div className="absolute left-2 top-2 flex gap-1">
            {i.pinned && <span className="rounded-pill bg-black/70 p-1 text-white"><Pin size={11} /></span>}
            {i.status === "approved" && <span className="rounded-pill bg-black/70 p-1 text-accent-green"><Check size={11} /></span>}
            {i.source === "gpt" && <span className="rounded-pill bg-black/70 px-1.5 py-0.5 text-[10px] text-white">GPT</span>}
            {i.hidden && <span className="rounded-pill bg-black/70 p-1 text-accent-orange"><EyeOff size={11} /></span>}
          </div>
          {likes(i) > 0 && (
            <span className="absolute right-2 top-2 flex items-center gap-1 rounded-pill bg-[var(--brand)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--brand-ink)]">
              <Heart size={10} fill="currentColor" /> {likes(i)}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function Reels({ reels }: { reels: Reel[] }) {
  if (!reels.length) return <p className="py-10 text-center text-[12.5px] text-text-muted">No reels for this brand yet. Queue one in <Link href="/dashboard/brand-reels" className="text-text underline">Reels</Link>.</p>;
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
      {reels.map((r) => (
        <Link key={r.id} href="/dashboard/brand-reels" className="flex min-w-0 flex-col gap-2">
          <div className="relative aspect-[9/16] overflow-hidden rounded-soft bg-[var(--bg)]">
            {r.final_url && <video src={`${r.final_url}#t=1.2`} preload="metadata" muted playsInline className="h-full w-full object-cover" />}
            <span className="absolute left-2 top-2 rounded-pill bg-black/70"><StatusPill status={REEL_LABEL[r.status] || r.status} tone={REEL_TONE[r.status]} /></span>
            {r.code && <span className="absolute right-2 top-2 rounded-pill bg-black/60 px-1.5 py-0.5 font-mono text-[10.5px] text-white">{r.code}</span>}
          </div>
          <p className="line-clamp-2 text-[12.5px] font-medium text-text">{r.title || "Untitled"}</p>
        </Link>
      ))}
    </div>
  );
}

// ── Reel order: what the client is reviewing ───────────────────

function ReelOrder({ ideas, items, brand, onOpen }: { ideas: Item[]; items: Item[]; brand: Brand; onOpen: (i: Item) => void }) {
  const kids = (id: string, k: string) => items.filter((i) => i.parent_id === id && i.kind === k).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const remove = async (id: string) => { if (confirm("Delete this from the reel order?")) { await fetch(`/api/ops/studio/items/${id}`, { method: "DELETE" }); location.reload(); } };
  const chosen = ideas.filter((i) => likes(i) > 0 || kids(i.id, "script").length || kids(i.id, "frame").length || kids(i.id, "video").length);
  const used = new Set(items.filter((i) => (i.kind === "script" || i.kind === "frame") && i.votes.some((v) => v.comment)).map((i) => i.id)).size;
  if (!chosen.length) return <p className="py-10 text-center text-[12.5px] text-text-muted">No idea chosen yet. Share the client board; once they choose an idea, add its script, board frames and final reel here with the composer above.</p>;
  return (
    <div className="flex flex-col gap-6">
      <p className="text-[12.5px] text-text-muted">{brand.reel_length || "Length not set"} · {used} of {brand.changes_allowed} changes used</p>
      {chosen.map((idea) => {
        const script = kids(idea.id, "script")[0];
        const frames = kids(idea.id, "frame");
        const video = kids(idea.id, "video")[0];
        return (
          <section key={idea.id} className="flex flex-col gap-4 rounded-panel border border-[var(--border)] bg-surface p-4">
            <div>
              <p className="text-[11px] font-medium text-text-muted">{likes(idea) ? `Chosen by ${idea.votes.filter((v) => v.choice === "like").map((v) => v.voter).join(", ")}` : "In production"}</p>
              <h3 className="text-[16px] font-semibold text-text">{idea.title}</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-semibold text-text">02 Script {script && script.votes.some((v) => v.choice === "like") && <span className="text-accent-green">· approved</span>}</p>
                {script ? (
                  <>
                    <p className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-soft bg-[var(--bg)] p-3 text-[12.5px] leading-relaxed text-text">{script.body}</p>
                    <VoteLine item={script} />
                    <button onClick={() => remove(script.id)} className="self-start text-[11.5px] text-text-muted hover:text-accent-red">Remove script</button>
                  </>
                ) : <p className="text-[12px] text-text-muted">Not added. Composer: Script.</p>}
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-semibold text-text">03 Visual board ({frames.length} frames)</p>
                {frames.length ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {frames.map((f, n) => (
                      <div key={f.id} className="flex flex-col gap-1">
                        <button onClick={() => onOpen(f)} className="relative overflow-hidden rounded-soft">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={f.url || ""} alt="" className="aspect-[9/16] w-full object-cover" />
                          <span className="absolute left-1 top-1 rounded bg-black/70 px-1 font-mono text-[10px] text-white">{String(n + 1).padStart(2, "0")}</span>
                          {f.votes.some((v) => v.comment) && <span className="absolute bottom-1 right-1 rounded-pill bg-accent-orange px-1.5 text-[10px] font-semibold text-black">change</span>}
                        </button>
                        {f.body && <p className="line-clamp-2 text-[10.5px] text-text-muted">{f.body}</p>}
                        {f.votes.filter((v) => v.comment).map((v) => <p key={v.voter} className="text-[10.5px] text-accent-orange">{v.voter}: {v.comment}</p>)}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-[12px] text-text-muted">Not added. Composer: Board frames.</p>}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-semibold text-text">04 Final reel</p>
              {video?.url ? <video src={video.url} controls className="aspect-[9/16] w-full max-w-[240px] rounded-soft bg-black" /> : <p className="text-[12px] text-text-muted">Not uploaded. Composer: Final reel.</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────

export default function StudioBrandPage({ params }: { params: { slug: string } }) {
  const [d, setD] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  const [view, setView] = useState<View>("board");
  const [open, setOpen] = useState<Item | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/ops/studio/${params.slug}`, { cache: "no-store" });
    if (r.status === 404) return setMissing(true);
    if (r.ok) setD(await r.json());
  }, [params.slug]);
  useEffect(() => { load(); }, [load]);
  // Editors add to the board while you watch; a slow refresh keeps it current.
  useEffect(() => { const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  if (missing) return <div className="p-6 text-[13px] text-text-muted">No brand called {params.slug}. <Link href="/dashboard/studio" className="text-text underline">Back to Studio</Link></div>;
  if (!d) return <div className="flex h-80 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={18} /></div>;

  const { brand, items, reels } = d;
  const images = items.filter((i) => i.kind === "image");
  const requests = items.filter((i) => i.kind === "request");
  const openReq = requests.filter((i) => i.status === "open" || i.status === "doing");
  const ideas = items.filter((i) => i.kind === "idea");
  const notes = items.filter((i) => i.kind === "note");
  // Most loved first: what the client wants us to make next.
  const picked = items.filter((i) => i.votes.length).sort((a, b) => likes(b) - likes(a) || passes(a) - passes(b));
  const tabs: Tab<View>[] = [
    { value: "board", label: "Board" },
    { value: "reel", label: "Reel order" },
    { value: "requests", label: "Requests", count: openReq.length },
    { value: "ideas", label: "Ideas", count: ideas.length },
    { value: "images", label: "Images", count: images.length },
    { value: "picks", label: "Client picks", count: picked.length },
    { value: "reels", label: "Reels", count: reels.length },
    { value: "brief", label: "Brief" },
  ];
  const optionsOf = (id: string) => images.filter((i) => i.parent_id === id);
  const textList = (list: Item[], empty: string) => list.length
    ? <div className="flex flex-col gap-2">{list.map((i) => <TextCard key={i.id} item={i} options={optionsOf(i.id)} onOpen={setOpen} onChanged={load} />)}</div>
    : <p className="py-6 text-center text-[12.5px] text-text-muted">{empty}</p>;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4 lg:p-6">
      <Header brand={brand} onSaved={load} />
      <SharePanel brand={brand} items={items} activity={d.activity || []} onChanged={load} />
      <Composer slug={brand.slug} ideas={ideas} existingFrames={(id) => items.filter((i) => i.kind === "frame" && i.parent_id === id).length} onAdded={load} />
      <SegmentedTabs tabs={tabs} value={view} onChange={setView} ariaLabel="Board sections" className="self-start" />

      {view === "board" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,380px)_1fr]">
          <div className="flex flex-col gap-4">
            <section>
              <h2 className="mb-2 text-[13px] font-semibold text-text">Waiting on the editors</h2>
              {textList(openReq, "Nothing waiting. Send a request above.")}
            </section>
            <section>
              <h2 className="mb-2 text-[13px] font-semibold text-text">Ideas</h2>
              {textList(ideas.filter((i) => i.status !== "parked").slice(0, 6), "No ideas yet.")}
            </section>
            {notes.length > 0 && (
              <section>
                <h2 className="mb-2 text-[13px] font-semibold text-text">Notes</h2>
                {textList(notes.slice(0, 4), "")}
              </section>
            )}
          </div>
          <section className="min-w-0">
            <h2 className="mb-2 text-[13px] font-semibold text-text">Board</h2>
            <ImageGrid images={images} onOpen={setOpen} />
          </section>
        </div>
      )}
      {view === "reel" && <ReelOrder ideas={ideas} items={items} brand={brand} onOpen={setOpen} />}
      {view === "requests" && textList(requests, "No requests yet.")}
      {view === "ideas" && textList([...ideas, ...notes], "No ideas yet.")}
      {view === "images" && <ImageGrid images={images} onOpen={setOpen} />}
      {view === "picks" && (picked.length ? (
        <div className="flex flex-col gap-2">
          {picked.map((i) => (
            <button key={i.id} onClick={() => i.kind === "image" ? setOpen(i) : setView("ideas")}
              className="flex items-start gap-3 rounded-soft border border-[var(--border)] bg-surface p-3 text-left hover:bg-[var(--surface-hover)]">
              {i.url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={i.url} alt="" className="h-20 w-16 shrink-0 rounded-soft object-cover" />
                : <span className="flex h-20 w-16 shrink-0 items-center justify-center rounded-soft bg-[var(--bg)] text-[10.5px] uppercase tracking-wide text-text-muted">Idea</span>}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="text-[13px] font-medium text-text">{i.title || "Untitled"}</p>
                <VoteLine item={i} />
              </div>
            </button>
          ))}
        </div>
      ) : <p className="py-10 text-center text-[12.5px] text-text-muted">No picks yet. Share the client board and their choices show up here.</p>)}
      {view === "reels" && <Reels reels={reels} />}
      {view === "brief" && (
        <section className="rounded-panel border border-[var(--border)] bg-surface p-4">
          <Editable value={brand.brief || ""} placeholder="Click to write the brief: what the brand is, who it is for, the rules, the risks." multiline
            onSave={async (v) => { await fetch(`/api/ops/studio/${brand.slug}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: v }) }); load(); }}
            className="min-h-[200px] whitespace-pre-wrap p-2 text-[13px] leading-relaxed text-text" />
        </section>
      )}

      {open && <Lightbox item={items.find((i) => i.id === open.id) || open} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  );
}
