"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clapperboard, Loader2, Plus } from "lucide-react";
import { StatusPill, type Tone } from "@/components/ui/StatusPill";
import { useRole } from "@/components/StudioShell";

/**
 * Studio home: every brand we are creating for. Each card says what we are going
 * after (mood + palette) and what is waiting (open requests), so the founder and the
 * editors see the whole slate in one look.
 */

type Brand = {
  id: string; slug: string; name: string; status: string; mood: string | null; palette: string[];
  cover_url: string | null; logo_url: string | null; updated_at: string;
  client_last: { at: string; kind: string; voter: string | null } | null;
  counts: { requests_open: number; ideas: number; images: number; reels: number; live: number };
};

const TONE: Record<string, Tone> = { intake: "info", active: "good", paused: "neutral" };

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function NewBrand({ onMade }: { onMade: (slug: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [site, setSite] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await fetch("/api/ops/studio", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, site_url: site }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error || "Could not add the brand. Try again.");
    onMade(j.slug);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-2 rounded-soft bg-[var(--brand)] px-4 text-[13px] font-semibold text-[var(--brand-ink)] hover:opacity-90">
        <Plus size={15} /> Add a brand
      </button>
    );
  }
  return (
    <form onSubmit={create} className="flex flex-wrap items-center gap-2">
      <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand name" aria-label="Brand name"
        className="h-10 w-44 rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-text outline-none placeholder:text-text-muted focus:border-[var(--brand-line)]" />
      <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="Website (optional)" aria-label="Website"
        className="h-10 w-56 rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-text outline-none placeholder:text-text-muted focus:border-[var(--brand-line)]" />
      <button disabled={busy} className="flex h-10 items-center gap-2 rounded-soft bg-[var(--brand)] px-4 text-[13px] font-semibold text-[var(--brand-ink)] disabled:opacity-50">
        {busy && <Loader2 size={14} className="animate-spin" />} Add
      </button>
      <button type="button" onClick={() => setOpen(false)} className="h-10 px-2 text-[13px] text-text-muted hover:text-text">Cancel</button>
      {err && <p className="w-full text-[12px] text-accent-red">{err}</p>}
    </form>
  );
}

function BrandCard({ b }: { b: Brand }) {
  return (
    <Link href={`/dashboard/studio/${b.slug}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-panel border border-[var(--border)] bg-surface transition-colors duration-150 hover:border-[var(--brand-line)]">
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--bg)]">
        {b.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.cover_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-text-muted">No images yet</div>
        )}
        {b.palette.length > 0 && (
          <div className="absolute inset-x-0 bottom-0 flex h-2">
            {b.palette.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
          </div>
        )}
        {b.counts.requests_open > 0 && (
          <span className="absolute right-3 top-3 rounded-pill bg-[var(--brand)] px-2 py-0.5 text-[11px] font-semibold text-[var(--brand-ink)]">
            {b.counts.requests_open} waiting
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-[15px] font-semibold tracking-tight text-text">{b.name}</h2>
          <StatusPill status={b.status} tone={TONE[b.status]} />
        </div>
        <p className="line-clamp-2 min-h-[2.6em] text-[12.5px] leading-snug text-text-muted">{b.mood || "No mood set yet"}</p>
        {b.client_last && Date.now() - new Date(b.client_last.at).getTime() < 7 * 864e5 && (
          <p className="flex items-center gap-1.5 text-[11.5px] text-text">
            <span className={`h-1.5 w-1.5 rounded-full ${Date.now() - new Date(b.client_last.at).getTime() < 3600e3 ? "bg-accent-green" : "bg-[var(--text-muted)]"}`} />
            Client {b.client_last.kind === "send" ? "sent picks" : b.client_last.kind === "choose" ? "chose an idea" : "active"}
            {b.client_last.voter ? ` (${b.client_last.voter})` : ""} · {ago(b.client_last.at)}
          </p>
        )}
        <p className="text-[11px] text-text-muted">
          {b.counts.images} images · {b.counts.ideas} ideas · {b.counts.reels} reels{b.counts.live ? ` (${b.counts.live} live)` : ""} · {ago(b.updated_at)}
        </p>
      </div>
    </Link>
  );
}

export default function StudioPage() {
  const role = useRole();
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/ops/studio", { cache: "no-store" });
    if (r.ok) setBrands((await r.json()).brands);
  }, []);
  useEffect(() => { load(); }, [load]);

  const waiting = brands?.reduce((n, b) => n + b.counts.requests_open, 0) ?? 0;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 lg:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text">Studio</h1>
          <p className="max-w-[62ch] text-[12.5px] text-text-muted">
            Every brand we are making for: the mood we are after, ideas, images, requests and reels.
            {waiting > 0 && <> <span className="text-text">{waiting} request{waiting > 1 ? "s" : ""} waiting</span> for the editors.</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {role === "owner" && <Link href="/dashboard/brand-reels"
            className="flex h-10 items-center gap-2 rounded-soft border border-[var(--border)] px-4 text-[13px] font-medium text-text hover:bg-[var(--surface-hover)]">
            <Clapperboard size={15} /> Reels
          </Link>}
          <NewBrand onMade={(slug) => (window.location.href = `/dashboard/studio/${slug}`)} />
        </div>
      </header>

      {brands === null ? (
        <div className="flex h-60 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={18} /></div>
      ) : brands.length === 0 ? (
        <div className="rounded-panel border border-[var(--border)] bg-surface px-4 py-16 text-center">
          <p className="text-[13px] text-text">No brands in the studio yet</p>
          <p className="text-[12px] text-text-muted">Add the first one to start a board.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {brands.map((b) => <BrandCard key={b.id} b={b} />)}
        </div>
      )}
    </div>
  );
}
