"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { MiniMarkdown } from "@/components/team/MiniMarkdown";

/**
 * The owner's editor for the team knowledge base: pick a section, add, edit or
 * remove entries. Entries PROXe pushed are marked; an edit to one lasts until
 * PROXe sends that entry again.
 */
type Section = { key: string; label: string; blurb: string };
type Entry = {
  id: string; section: string; title: string; body: string; url: string | null; when_to_share: string | null
  tags: string[]; position: number; source: "arc" | "proxe";
};
type Draft = { id?: string; section: string; title: string; body: string; url: string; when_to_share: string; tags: string; position: number };

const input = "h-9 w-full rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-text outline-none placeholder:text-text-muted focus:border-[var(--brand-line)]";
const btn = "flex h-9 items-center gap-1.5 rounded-soft border border-[var(--border)] px-3 text-[12.5px] text-text hover:bg-[var(--surface-hover)] disabled:opacity-50";
const primary = "flex h-9 items-center gap-1.5 rounded-soft bg-[var(--brand)] px-3.5 text-[12.5px] font-semibold text-[var(--brand-ink)] hover:opacity-90 disabled:opacity-50";

const blank = (section: string, position: number): Draft => ({ section, title: "", body: "", url: "", when_to_share: "", tags: "", position });

export function KbEditor() {
  const [data, setData] = useState<{ sections: Section[]; entries: Entry[] } | null>(null);
  const [tab, setTab] = useState("pipeline");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/team/kb", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setData(j); else setMsg(j.error || "Couldn't load the knowledge base.");
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!draft) return;
    setBusy(true); setMsg("");
    const r = await fetch(draft.id ? `/api/team/kb/${draft.id}` : "/api/team/kb", {
      method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, id: undefined }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(j.error || "Couldn't save.");
    setDraft(null); setMsg("Saved. The team sees it now, and Ask answers from it."); load();
  }
  async function remove(e: Entry) {
    if (!confirm(`Remove "${e.title}" from the playbook?`)) return;
    const r = await fetch(`/api/team/kb/${e.id}`, { method: "DELETE" });
    if (r.ok) load(); else setMsg("Couldn't remove it.");
  }

  if (!data) return <div className="flex h-24 items-center justify-center text-text-muted">{msg || <Loader2 className="animate-spin" size={16} />}</div>;
  const rows = data.entries.filter((e) => e.section === tab).sort((a, b) => a.position - b.position);
  const isLinks = draft?.section === "links";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {data.sections.map((s) => (
          <button key={s.key} onClick={() => { setTab(s.key); setDraft(null); }} aria-pressed={tab === s.key}
            className={`h-8 rounded-pill border px-3 text-[12px] ${tab === s.key ? "border-[var(--brand-line)] bg-[var(--brand)] font-semibold text-[var(--brand-ink)]" : "border-[var(--border)] text-text-muted hover:text-text"}`}>
            {s.label} <span className="opacity-60">{data.entries.filter((e) => e.section === s.key).length}</span>
          </button>
        ))}
      </div>

      {draft ? (
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px_90px]">
            <input className={input} placeholder={draft.section === "rebuttals" ? 'What they say, e.g. "It\'s too expensive."' : "Title"} value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label="Title" />
            <select className={input} value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })} aria-label="Section">
              {data.sections.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <input type="number" className={input} value={draft.position} onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) })} aria-label="Order" title="Order in the section" />
          </div>
          {preview ? (
            <div className="min-h-[140px] rounded-lg border border-[var(--border)] p-3"><MiniMarkdown text={draft.body} /></div>
          ) : (
            <textarea rows={8} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} aria-label="Body"
              placeholder={draft.section === "rebuttals" ? "What you say back. The first paragraph is what Copy answer copies." : "Markdown: **bold**, - lists, # headings"}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[12.5px] leading-relaxed text-text outline-none focus:border-[var(--brand-line)]" />
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input className={input} placeholder="Link (optional), https://…" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} aria-label="Link" />
            <input className={input} placeholder="Tags, comma separated (helps search)" value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} aria-label="Tags" />
          </div>
          {(isLinks || draft.when_to_share) && (
            <input className={input} placeholder="When to share it" value={draft.when_to_share} onChange={(e) => setDraft({ ...draft, when_to_share: e.target.value })} aria-label="When to share" />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button className={primary} disabled={busy || !draft.title.trim()} onClick={save}>{busy ? "Saving…" : "Save"}</button>
            <button className={btn} onClick={() => setPreview(!preview)}>{preview ? "Edit" : "Preview"}</button>
            <button className={btn} onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className={btn + " self-start"} onClick={() => setDraft(blank(tab, (rows.at(-1)?.position ?? 0) + 1))}><Plus size={14} /> Add to {data.sections.find((s) => s.key === tab)?.label}</button>
      )}

      <ul className="flex flex-col">
        {rows.map((e) => (
          <li key={e.id} className="flex items-start gap-2 border-t border-[var(--border)] py-2 first:border-t-0">
            <span className="w-6 shrink-0 pt-0.5 text-right text-[11px] tabular-nums text-text-muted">{e.position}</span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-text">
                {e.title}
                {e.source === "proxe" && <span className="rounded-pill bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] text-[var(--brand-text)]">from PROXe</span>}
                {/\(confirm\)/i.test(e.title + e.body) && <span className="rounded-pill bg-[rgba(245,158,11,0.14)] px-1.5 py-0.5 text-[10px] text-accent-orange">confirm</span>}
              </p>
              <p className="line-clamp-1 text-[11.5px] text-text-muted">{e.when_to_share || e.body.replace(/[*#>]/g, "").slice(0, 160)}</p>
            </div>
            <button aria-label={`Edit ${e.title}`} className="p-1 text-text-muted hover:text-text"
              onClick={() => setDraft({ id: e.id, section: e.section, title: e.title, body: e.body, url: e.url || "", when_to_share: e.when_to_share || "", tags: e.tags.join(", "), position: e.position })}>
              <Pencil size={14} />
            </button>
            <button aria-label={`Remove ${e.title}`} className="p-1 text-text-muted hover:text-accent-red" onClick={() => remove(e)}><Trash2 size={14} /></button>
          </li>
        ))}
        {!rows.length && <li className="py-3 text-[12.5px] text-text-muted">Nothing in this section yet.</li>}
      </ul>
      {msg && <p className="text-[12px] text-text-muted">{msg}</p>}
      <p className="text-[11px] text-text-muted">
        Entries marked <span className="text-accent-orange">confirm</span> are drafts that need your check before the team relies on them.
        PROXe can also push entries to <code className="text-text">/api/agent/team-kb</code>; those show as &ldquo;from PROXe&rdquo;.
      </p>
    </div>
  );
}
