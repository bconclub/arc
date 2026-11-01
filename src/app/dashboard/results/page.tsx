"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, ExternalLink, Plus } from "lucide-react";
import { Modal, Field, ModalActions, inputCls, btnPrimaryCls } from "@/components/ops/Modal";

type SocialPost = {
  id: string;
  platform: string;
  external_id: string;
  url: string | null;
  posted_at: string | null;
  text_preview: string | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  collected_at: string;
};

type Channel = "linkedin" | "x";
type Period = "30" | "90" | "all";
type Sort = "newest" | "views";

const CHANNEL_LABEL: Record<Channel, string> = { linkedin: "LinkedIn", x: "X" };
const METRICS = [
  ["impressions", "Views"],
  ["likes", "Likes"],
  ["comments", "Comments"],
  ["shares", "Reposts"],
] as const;

type Form = {
  platform: Channel; url: string; posted_at: string; text_preview: string;
  impressions: string; likes: string; comments: string; shares: string;
};
const EMPTY: Form = {
  platform: "linkedin", url: "", posted_at: new Date().toISOString().slice(0, 10), text_preview: "",
  impressions: "", likes: "", comments: "", shares: "",
};

const num = (v: number | null) => (v == null ? "-" : v.toLocaleString("en-IN"));
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No date";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export default function ResultsPage() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [channel, setChannel] = useState<Channel | "all">("all");
  const [period, setPeriod] = useState<Period>("90");
  const [sort, setSort] = useState<Sort>("newest");
  const [form, setForm] = useState<Form | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await fetch("/api/social/posts").then((r) => r.json()).catch(() => []);
    setPosts(Array.isArray(data) ? data : []);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const inPeriod = useMemo(() => {
    if (period === "all") return posts;
    const cutoff = Date.now() - Number(period) * 864e5;
    return posts.filter((p) => p.posted_at && new Date(p.posted_at).getTime() >= cutoff);
  }, [posts, period]);

  const visible = useMemo(() => {
    const rows = inPeriod.filter((p) => channel === "all" || p.platform === channel);
    if (sort === "views") return [...rows].sort((a, b) => (b.impressions ?? -1) - (a.impressions ?? -1));
    return rows;
  }, [inPeriod, channel, sort]);

  const lastUpdated = useMemo(
    () => posts.reduce<string | null>((latest, p) => (!latest || p.collected_at > latest ? p.collected_at : latest), null),
    [posts],
  );

  function openEdit(p: SocialPost) {
    setError("");
    setEditingId(p.external_id);
    setForm({
      platform: p.platform as Channel,
      url: p.url ?? "",
      posted_at: p.posted_at ? p.posted_at.slice(0, 10) : "",
      text_preview: p.text_preview ?? "",
      impressions: p.impressions?.toString() ?? "",
      likes: p.likes?.toString() ?? "",
      comments: p.comments?.toString() ?? "",
      shares: p.shares?.toString() ?? "",
    });
  }

  async function save() {
    if (!form) return;
    setSaving(true); setError("");
    const res = await fetch("/api/social/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, external_id: editingId ?? undefined }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Save failed.");
      return;
    }
    setForm(null); load();
  }

  const pill = (active: boolean) =>
    `rounded-lg px-2.5 py-1 text-[12px] transition-colors ${active ? "bg-white/[0.1] text-text" : "text-text-muted hover:text-text"}`;

  return (
    <div className="page space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <BarChart3 size={18} className="text-text-muted" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text">Results</h1>
            <p className="mt-0.5 text-[13px] text-text-muted">
              What landed on LinkedIn and X{lastUpdated ? ` · numbers updated ${day(lastUpdated)}` : ""}
            </p>
          </div>
        </div>
        <button
          className={`${btnPrimaryCls} flex shrink-0 items-center gap-1.5`}
          onClick={() => { setError(""); setEditingId(null); setForm({ ...EMPTY }); }}
        >
          <Plus size={13} /> Add post
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => {
          const rows = inPeriod.filter((p) => p.platform === c);
          const counted = rows.filter((p) => p.impressions != null).map((p) => p.impressions as number);
          const sum = (key: "impressions" | "likes" | "comments" | "shares") =>
            rows.reduce((total, p) => total + (p[key] ?? 0), 0);
          const stats: [string, string][] = [
            ["Posts", rows.length.toLocaleString("en-IN")],
            ["Views", sum("impressions").toLocaleString("en-IN")],
            ["Typical views", num(median(counted))],
            ["Likes", sum("likes").toLocaleString("en-IN")],
            ["Comments", sum("comments").toLocaleString("en-IN")],
            ["Reposts", sum("shares").toLocaleString("en-IN")],
          ];
          return (
            <div key={c} className="rounded-card border border-[var(--border)] bg-surface p-4">
              <p className="text-[13px] font-semibold text-text">{CHANNEL_LABEL[c]}</p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {stats.map(([label, value]) => (
                  <div key={label}>
                    <p className="text-lg font-bold tabular-nums tracking-tight text-text">{value}</p>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          {(["all", "linkedin", "x"] as const).map((c) => (
            <button key={c} className={pill(channel === c)} onClick={() => setChannel(c)}>
              {c === "all" ? "All" : CHANNEL_LABEL[c]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {([["30", "30 days"], ["90", "90 days"], ["all", "All time"]] as const).map(([p, label]) => (
            <button key={p} className={pill(period === p)} onClick={() => setPeriod(p)}>{label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {([["newest", "Newest"], ["views", "Most views"]] as const).map(([s, label]) => (
            <button key={s} className={pill(sort === s)} onClick={() => setSort(s)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {loaded && visible.length === 0 ? (
          <div className="rounded-card border border-[var(--border)] bg-surface p-8 text-center">
            <p className="text-sm text-text-muted">No posts in this view yet.</p>
          </div>
        ) : (
          visible.map((p) => (
            <div key={p.id} className="rounded-card border border-[var(--border)] bg-surface p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-[11px] text-text-muted">
                    {CHANNEL_LABEL[p.platform as Channel] ?? p.platform} · {day(p.posted_at)}
                  </p>
                  <p className="line-clamp-2 text-[14px] text-text">{p.text_preview || "No text saved"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button className="text-[12px] text-text-muted hover:text-text" onClick={() => openEdit(p)}>Edit</button>
                  {p.url && /^https:\/\//.test(p.url) && (
                    <a href={p.url} target="_blank" rel="noreferrer" aria-label="Open post" className="text-text-muted hover:text-text">
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {METRICS.map(([key, label]) => (
                  <div key={key}>
                    <p className="text-[15px] font-semibold tabular-nums text-text">{num(p[key])}</p>
                    <p className="text-[9px] uppercase tracking-wider text-text-muted">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {form && (
        <Modal title={editingId ? "Edit post" : "Add post"} onClose={() => setForm(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Platform">
              <select
                className={inputCls}
                value={form.platform}
                disabled={!!editingId}
                onChange={(e) => setForm({ ...form, platform: e.target.value as Channel })}
              >
                <option value="linkedin">LinkedIn</option>
                <option value="x">X</option>
              </select>
            </Field>
            <Field label="Posted on">
              <input type="date" className={inputCls} value={form.posted_at} onChange={(e) => setForm({ ...form, posted_at: e.target.value })} />
            </Field>
          </div>
          <Field label="Link to the post">
            <input className={inputCls} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </Field>
          <Field label="Post text">
            <textarea className={inputCls} rows={3} value={form.text_preview} onChange={(e) => setForm({ ...form, text_preview: e.target.value })} />
          </Field>
          <div className="grid grid-cols-4 gap-3">
            {METRICS.map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  type="number"
                  min="0"
                  className={inputCls}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          {error && <p className="text-[12px] text-accent-red">{error}</p>}
          <ModalActions onCancel={() => setForm(null)} onSave={save} saving={saving} />
        </Modal>
      )}
    </div>
  );
}
