"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Copy, ExternalLink, Loader2, MessageCircle, Search } from "lucide-react";
import { MiniMarkdown } from "@/components/team/MiniMarkdown";

/**
 * Playbook: everything the sales team needs, searchable. The pipeline is the
 * main page; then what PROXe is, links to share and when, rebuttals, pricing,
 * how we work and FAQs. The owner edits it on the Team page; PROXe can push
 * entries too. The Ask assistant answers from exactly this.
 */
type Section = { key: string; label: string; blurb: string };
type Entry = {
  id: string; section: string; title: string; body: string; url: string | null; when_to_share: string | null
  tags: string[]; position: number; source: "arc" | "proxe";
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}
      className="flex h-8 items-center gap-1.5 rounded-soft border border-[var(--border)] px-2.5 text-[12px] text-text hover:bg-[var(--surface-hover)]">
      {done ? <Check size={13} className="text-accent-green" /> : <Copy size={13} />} {done ? "Copied" : label}
    </button>
  );
}

/** Plain text of a rebuttal answer, for copying: drop markdown bold and the coaching notes after a blank line. */
const answerText = (body: string) => body.split(/\n\s*\n/)[0].replace(/\*\*/g, "").replace(/^"|"$/g, "").trim();

type Live = { id: string; section: string; name: string; stage: string | null; card: string | null; next_step: string | null; words: number | null; actions: number | null };

/** PROXe's live pipeline: who is where right now, what's next, and how committed they are. */
function LivePipeline() {
  const [rows, setRows] = useState<Live[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch("/api/team/pipeline", { cache: "no-store" }).then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't load the pipeline.");
      setRows(j.rows || []);
    }).catch((e) => setErr(e.message));
  }, []);
  if (err) return <p className="text-[12.5px] text-accent-red">{err}</p>;
  if (!rows) return <div className="flex h-24 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={16} /></div>;
  if (!rows.length) return null;
  const groups: [string, string, Live[]][] = [
    ["customer", "Customers and trials", rows.filter((r) => r.section === "customer")],
    ["prospect", "Prospects", rows.filter((r) => r.section !== "customer")],
  ];
  return (
    <section className="flex flex-col gap-3 rounded-panel border border-[var(--border)] bg-surface p-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-text">The pipeline right now</h2>
        <p className="text-[11.5px] text-text-muted">Live from PROXe. Commitment is what they said vs what they did (time, effort, money, out of 5): actions count more than words.</p>
      </div>
      {groups.filter(([, , g]) => g.length).map(([key, label, g]) => (
        <div key={key} className="flex flex-col gap-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{label} · {g.length}</p>
          <ul className="flex flex-col">
            {g.map((r) => (
              <li key={r.id} className="grid grid-cols-1 gap-x-3 gap-y-0.5 border-t border-[var(--border)] py-2 first:border-t-0 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto]">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-text">{r.name}</p>
                  <p className="text-[12px] text-text-muted">{r.stage || "No stage yet"}{r.card ? ` · ${r.card}` : ""}</p>
                </div>
                <p className="text-[12.5px] text-text">{r.next_step ? <><span className="text-text-muted">Next: </span>{r.next_step}</> : <span className="text-text-muted">No next step</span>}</p>
                {(r.words != null || r.actions != null) && (
                  <p className="whitespace-nowrap text-[11.5px] tabular-nums text-text-muted" title="Commitment: words / actions, out of 5">
                    said {r.words ?? "-"} · did <span className={r.actions != null && r.actions >= 4 ? "font-semibold text-accent-green" : "text-text"}>{r.actions ?? "-"}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function Pipeline({ entries }: { entries: Entry[] }) {
  return (
    <ol className="flex flex-col">
      {entries.map((e, i) => (
        <li key={e.id} className="relative flex gap-4 pb-5 last:pb-0">
          {i < entries.length - 1 && <span aria-hidden className="absolute left-[15px] top-9 h-[calc(100%-2.25rem)] w-px bg-[var(--border)]" />}
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[13px] font-bold text-[var(--brand-ink)]">{i + 1}</span>
          <div className="min-w-0 flex-1 rounded-panel border border-[var(--border)] bg-surface p-4">
            <h3 className="text-[15px] font-semibold tracking-tight text-text">{e.title}</h3>
            <div className="mt-2"><MiniMarkdown text={e.body} /></div>
            {e.url && (
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton text={e.url} label="Copy link" />
                <a href={e.url} target="_blank" rel="noreferrer" className="flex h-8 items-center gap-1.5 rounded-soft px-2.5 text-[12px] text-text-muted hover:text-text"><ExternalLink size={13} /> Open</a>
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function LinkCard({ e }: { e: Entry }) {
  return (
    <div className="flex flex-col gap-2 rounded-panel border border-[var(--border)] bg-surface p-4">
      <h3 className="text-[14px] font-semibold text-text">{e.title}</h3>
      {e.body && <p className="text-[12.5px] text-text-muted">{e.body}</p>}
      {e.when_to_share && (
        <p className="rounded-lg bg-[var(--brand-soft)] px-3 py-2 text-[12.5px] text-[var(--brand-text)]">
          <span className="font-semibold">When to share: </span>{e.when_to_share}
        </p>
      )}
      {e.url && (
        <>
          <p className="truncate text-[11.5px] text-text-muted" title={e.url}>{e.url.replace(/^https?:\/\//, "")}</p>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={e.url} label="Copy link" />
            <a href={e.url} target="_blank" rel="noreferrer" className="flex h-8 items-center gap-1.5 rounded-soft px-2.5 text-[12px] text-text-muted hover:text-text"><ExternalLink size={13} /> Open</a>
          </div>
        </>
      )}
    </div>
  );
}

function RebuttalCard({ e }: { e: Entry }) {
  return (
    <div className="flex flex-col gap-2 rounded-panel border border-[var(--border)] bg-surface p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">They say</p>
      <h3 className="text-[15px] font-semibold text-text">{e.title}</h3>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">You say</p>
      <MiniMarkdown text={e.body} />
      <div className="mt-1 flex flex-wrap gap-2">
        <CopyButton text={answerText(e.body)} label="Copy answer" />
        {e.url && <a href={e.url} target="_blank" rel="noreferrer" className="flex h-8 items-center gap-1.5 rounded-soft px-2.5 text-[12px] text-text-muted hover:text-text"><ExternalLink size={13} /> Related link</a>}
      </div>
    </div>
  );
}

function PlainCard({ e }: { e: Entry }) {
  return (
    <div className="rounded-panel border border-[var(--border)] bg-surface p-4">
      <h3 className="text-[15px] font-semibold tracking-tight text-text">{e.title}</h3>
      <div className="mt-2"><MiniMarkdown text={e.body} /></div>
      {e.url && (
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton text={e.url} label="Copy link" />
          <a href={e.url} target="_blank" rel="noreferrer" className="flex h-8 items-center gap-1.5 rounded-soft px-2.5 text-[12px] text-text-muted hover:text-text"><ExternalLink size={13} /> Open</a>
        </div>
      )}
    </div>
  );
}

function Card({ e }: { e: Entry }) {
  return e.section === "links" ? <LinkCard e={e} /> : e.section === "rebuttals" ? <RebuttalCard e={e} /> : <PlainCard e={e} />;
}

function PlaybookInner() {
  const params = useSearchParams();
  const [data, setData] = useState<{ sections: Section[]; entries: Entry[] } | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState(params.get("s") || "pipeline");
  const [q, setQ] = useState(params.get("q") || "");

  useEffect(() => {
    fetch("/api/team/kb").then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't load the playbook.");
      setData(j);
    }).catch((e) => setErr(e.message));
  }, []);

  const results = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!data || !words.length) return null;
    return data.entries
      .map((e) => {
        const title = e.title.toLowerCase(), rest = [e.body, e.when_to_share, e.url, e.tags.join(" ")].join(" ").toLowerCase();
        if (!words.every((w) => title.includes(w) || rest.includes(w))) return null;
        // Title hits rank first, then rebuttals and links (the things you need mid-call).
        const score = words.filter((w) => title.includes(w)).length * 10 + (e.section === "rebuttals" ? 3 : e.section === "links" ? 2 : 0);
        return { e, score };
      })
      .filter((x): x is { e: Entry; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.e);
  }, [data, q]);

  const sectionLabel = (k: string) => data?.sections.find((s) => s.key === k)?.label || k;
  const current = data?.sections.find((s) => s.key === tab);
  const inTab = (data?.entries || []).filter((e) => e.section === tab).sort((a, b) => a.position - b.position);

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-text">Playbook</h1>
            <p className="text-[12.5px] text-text-muted">Everything you need to sell PROXe. Search it mid-call, or read it end to end in your first week.</p>
          </div>
          <Link href="/team/ask" className="flex h-10 items-center gap-2 rounded-soft border border-[var(--border)] px-3 text-[13px] text-text hover:bg-[var(--surface-hover)]">
            <MessageCircle size={15} /> Ask instead
          </Link>
        </div>
        <label className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the playbook"
            placeholder='Search: "expensive", "WATI", "trial", "clinic", "demo"…'
            className="h-12 w-full rounded-panel border border-[var(--border)] bg-surface pl-10 pr-4 text-[14px] text-text outline-none placeholder:text-text-muted focus:border-[var(--brand-line)]" />
        </label>
        {!results && data && (
          <nav aria-label="Playbook sections" className="flex flex-wrap gap-1.5">
            {data.sections.map((s) => (
              <button key={s.key} onClick={() => setTab(s.key)} aria-pressed={tab === s.key}
                className={`h-8 rounded-pill border px-3 text-[12.5px] ${tab === s.key ? "border-[var(--brand-line)] bg-[var(--brand)] font-semibold text-[var(--brand-ink)]" : "border-[var(--border)] text-text-muted hover:text-text"}`}>
                {s.label}
                <span className="ml-1.5 opacity-60">{data.entries.filter((e) => e.section === s.key).length}</span>
              </button>
            ))}
          </nav>
        )}
      </header>

      {err ? (
        <p className="text-[13px] text-accent-red">{err}</p>
      ) : !data ? (
        <div className="flex h-40 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={18} /></div>
      ) : results ? (
        <section className="flex flex-col gap-3">
          <p className="text-[12px] text-text-muted">{results.length} result{results.length === 1 ? "" : "s"} for &ldquo;{q.trim()}&rdquo;</p>
          {results.map((e) => (
            <div key={e.id} className="flex flex-col gap-1">
              <p className="text-[10.5px] font-medium uppercase tracking-wide text-text-muted">{sectionLabel(e.section)}</p>
              <Card e={e} />
            </div>
          ))}
          {!results.length && (
            <div className="rounded-panel border border-[var(--border)] bg-surface px-4 py-8 text-center">
              <p className="text-[13px] text-text">Nothing in the playbook matches.</p>
              <Link href={`/team/ask?q=${encodeURIComponent(q.trim())}`} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-text-muted underline hover:text-text">
                Ask the assistant instead
              </Link>
            </div>
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          {current && <p className="text-[12.5px] text-text-muted">{current.blurb}</p>}
          {tab === "pipeline" ? (
            <>
              <LivePipeline />
              <h2 className="mt-2 text-[15px] font-semibold tracking-tight text-text">The stages, and what you do at each</h2>
              <Pipeline entries={inTab} />
            </>
          ) : (
            <div className={tab === "links" || tab === "rebuttals" ? "grid grid-cols-1 gap-3 md:grid-cols-2" : "flex flex-col gap-3"}>
              {inTab.map((e) => <Card key={e.id} e={e} />)}
            </div>
          )}
          {!inTab.length && <p className="text-[12.5px] text-text-muted">Nothing here yet. Z adds entries from the Team page.</p>}
        </section>
      )}
    </div>
  );
}

export default function TeamPlaybook() {
  return (
    <Suspense fallback={null}>
      <PlaybookInner />
    </Suspense>
  );
}
