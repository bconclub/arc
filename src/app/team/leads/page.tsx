"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { outcomeLabel } from "@/lib/outreach-workflow";
import type { OutreachTarget } from "@/types/ops";
import { LeadRow } from "@/components/team/LeadRow";
import { LeadModals, dueBy, isInbound, isOpen, todayIso, useTeamData } from "@/components/team/useTeamData";

/**
 * Every lead the sales team works: inbound (from PROXe) and outbound (ARC's
 * prospect lists) in one list. Starts on "Mine"; due follow-ups first.
 */
type Who = "mine" | "unassigned" | "all";
type From = "all" | "inbound" | "outbound";
type Stage = "open" | "due" | "won" | "lost" | "all";

function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} aria-pressed={value === v}
          className={`h-8 rounded-pill border px-3 text-[12px] ${value === v ? "border-[var(--brand-line)] bg-[var(--brand)] text-[var(--brand-ink)]" : "border-[var(--border)] text-text-muted hover:text-text"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

export default function TeamLeads() {
  const { me, leads, calls, error, byTarget, reload } = useTeamData();
  const [who, setWho] = useState<Who | null>(null);
  const [from, setFrom] = useState<From>("all");
  const [stage, setStage] = useState<Stage>("open");
  const [q, setQ] = useState("");
  // The open lead is read from the list each render, so a save or reassignment shows at once.
  const [openId, setOpenId] = useState<string | null>(null);
  const [call, setCall] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState("");
  const [limit, setLimit] = useState(100);

  const myId = me?.me?.id ?? null;
  const whoNow: Who = who ?? (myId ? "mine" : "all");
  const names = useMemo(() => new Map((me?.members || []).map((m) => [m.id, m.name])), [me]);
  const today = todayIso();

  const list = useMemo(() => {
    const words = q.trim().toLowerCase();
    return (leads?.targets || [])
      .filter((t) => whoNow === "all" || (whoNow === "mine" ? t.owner_id === myId : !t.owner_id))
      .filter((t) => from === "all" || (from === "inbound") === isInbound(t))
      .filter((t) => stage === "all" || (stage === "open" ? isOpen(t) : stage === "due" ? dueBy(t, today) : t.status === stage))
      .filter((t) => !words || [t.name, t.org, t.city, t.segment, t.phone, t.email].some((v) => v?.toLowerCase().includes(words)))
      .sort((a, b) => {
        // Due follow-ups first (oldest due first), then the freshest inbound, then newest.
        const da = dueBy(a, today), db = dueBy(b, today);
        if (da !== db) return da ? -1 : 1;
        if (da && db) return (a.next_at || "").localeCompare(b.next_at || "");
        const ta = a.inbound?.came_in_at || a.created_at, tb = b.inbound?.came_in_at || b.created_at;
        return tb.localeCompare(ta);
      });
  }, [leads, whoNow, myId, from, stage, q, today]);

  async function syncNow() {
    setSyncing(true); setSyncNote("");
    const r = await fetch("/api/team/leads/sync", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setSyncing(false);
    setSyncNote(!r.ok ? j.error || "PROXe sync failed." : j.skipped ? j.skipped : j.added ? `${j.added} new inbound lead${j.added === 1 ? "" : "s"} added.` : "No new inbound leads.");
    reload();
  }

  const open: Partial<OutreachTarget> | null = openId === "new"
    ? { kind: "business", status: "identified", source: "manual" }
    : (leads?.targets.find((t) => t.id === openId) ?? null);

  const lastWork = (t: OutreachTarget) => {
    const a = byTarget.get(t.id)?.[0];
    return a ? `${outcomeLabel(a.outcome)} ${timeAgo(a.occurred_at)}` : undefined;
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text">Leads</h1>
          <p className="text-[12.5px] text-text-muted">
            Inbound leads from PROXe and outbound prospects, in one list. Tap a lead to call, log what happened and set the next follow-up.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={syncNow} disabled={syncing}
            className="flex h-10 items-center gap-2 rounded-soft border border-[var(--border)] px-3 text-[13px] text-text hover:bg-[var(--surface-hover)] disabled:opacity-50">
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Check PROXe for new leads
          </button>
          <button onClick={() => setOpenId("new")}
            className="flex h-10 items-center gap-2 rounded-soft bg-[var(--brand)] px-4 text-[13px] font-semibold text-[var(--brand-ink)] hover:opacity-90">
            <Plus size={15} /> Add lead
          </button>
        </div>
      </header>

      {(syncNote || leads?.sync_error) && <p className="text-[12px] text-text-muted">{syncNote || leads?.sync_error}</p>}

      <div className="flex flex-col gap-2 rounded-panel border border-[var(--border)] bg-surface p-3">
        <div className="flex flex-wrap items-center gap-3">
          {myId && <Chips<Who> value={whoNow} onChange={setWho} options={[["mine", "Mine"], ["unassigned", "Unassigned"], ["all", "Everyone's"]]} />}
          <Chips<From> value={from} onChange={setFrom} options={[["all", "Inbound + outbound"], ["inbound", "Inbound"], ["outbound", "Outbound"]]} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Chips<Stage> value={stage} onChange={setStage} options={[["open", "Open"], ["due", "Follow-up due"], ["won", "Won"], ["lost", "Lost"], ["all", "All"]]} />
          <label className="relative ml-auto min-w-[200px] flex-1 sm:max-w-[280px]">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, company, city, phone" aria-label="Search leads"
              className="h-9 w-full rounded-soft border border-[var(--border)] bg-[var(--bg)] pl-8 pr-3 text-[13px] text-text outline-none placeholder:text-text-muted focus:border-[var(--brand-line)]" />
          </label>
        </div>
      </div>

      {error ? (
        <p className="text-[13px] text-accent-red">{error}</p>
      ) : !leads ? (
        <div className="flex h-40 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={18} /></div>
      ) : (
        <section className="overflow-hidden rounded-panel border border-[var(--border)] bg-surface">
          <p className="border-b border-[var(--border)] px-3 py-2 text-[11.5px] text-text-muted">
            {list.length} lead{list.length === 1 ? "" : "s"}
            {leads.inbound_synced_at ? ` · PROXe checked ${timeAgo(leads.inbound_synced_at)}` : ""}
          </p>
          <ul>
            {list.slice(0, limit).map((t) => (
              <LeadRow key={t.id} t={t} owner={t.owner_id ? names.get(t.owner_id) || null : null} lastWork={lastWork(t)} onOpen={() => setOpenId(t.id)} />
            ))}
          </ul>
          {!list.length && <p className="px-3 py-10 text-center text-[13px] text-text-muted">No leads match. Try Everyone&apos;s or All.</p>}
          {list.length > limit && (
            <button onClick={() => setLimit((n) => n + 200)} className="w-full border-t border-[var(--border)] py-2.5 text-[12.5px] text-text-muted hover:text-text">
              Show more ({list.length - limit} left)
            </button>
          )}
        </section>
      )}

      <LeadModals target={open} activity={open?.id ? byTarget.get(open.id) || [] : []} calls={calls} ready={leads?.reportingReady ?? false}
        onClose={() => setOpenId(null)} onSaved={reload} call={call} setCall={setCall} />
    </div>
  );
}
