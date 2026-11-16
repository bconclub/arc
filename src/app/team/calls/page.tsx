"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Loader2, Play, RefreshCw } from "lucide-react";
import type { OutreachTarget } from "@/types/ops";
import { LeadModals, useTeamData } from "@/components/team/useTeamData";
import type { DialerCallRow, DialerState } from "@/components/team/Dialer";
import { DialerCallCard, ist } from "@/components/team/DialerCallCard";
import type { BdrCall } from "@/components/outreach/CallReview";

/**
 * Every call in one place: the AI caller's (BDR) calls and the team's own calls
 * from the dialer, newest first. Listen, read what was said, open the lead.
 * Team calls show only your own (the owner sees everyone's). No costs here;
 * those stay with the owner.
 */
const tail = (p?: string | null) => (p || "").replace(/\D/g, "").slice(-10);
type Source = "all" | "team" | "ai";
type Item = { kind: "ai"; at: string; c: BdrCall } | { kind: "team"; at: string; c: DialerCallRow };

export default function TeamCalls() {
  const { me, leads, calls, callsState, byTarget, reload, reloadCalls } = useTeamData();
  const [source, setSource] = useState<Source>("all");
  const [scope, setScope] = useState<"mine" | "all">("all");
  const [hideTests, setHideTests] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [call, setCall] = useState<string | null>(null);
  const [team, setTeam] = useState<DialerState | null>(null);
  const [teamState, setTeamState] = useState<"loading" | "ready" | "error">("loading");

  const loadTeam = useCallback(async () => {
    setTeamState("loading");
    try {
      const r = await fetch("/api/team/dialer?days=30", { cache: "no-store" });
      if (!r.ok) throw new Error();
      setTeam(await r.json());
      setTeamState("ready");
    } catch {
      setTeamState("error");
    }
  }, []);
  useEffect(() => { loadTeam(); }, [loadTeam]);

  const byPhone = useMemo(() => {
    const m = new Map<string, OutreachTarget>();
    for (const t of leads?.targets || []) if (tail(t.phone).length === 10) m.set(tail(t.phone), t);
    return m;
  }, [leads]);
  const names = useMemo(() => new Map((team?.members || []).map((m) => [m.id, m.name])), [team]);
  const myId = me?.me?.id;

  const list = useMemo(() => {
    const out: Item[] = [];
    if (source !== "team") {
      for (const c of calls) {
        if (hideTests && c.is_test) continue;
        if (scope === "mine" && byPhone.get(tail(c.phone))?.owner_id !== myId) continue;
        out.push({ kind: "ai", at: c.started_at, c });
      }
    }
    if (source !== "ai") for (const c of team?.calls || []) out.push({ kind: "team", at: c.started_at, c });
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [calls, team, source, scope, hideTests, byPhone, myId]);

  const open: Partial<OutreachTarget> | null = leads?.targets.find((t) => t.id === openId) ?? null;
  // Show what has arrived: team calls come at once, the AI caller's history takes a while.
  const aiLoading = source !== "team" && callsState === "loading" && !calls.length;
  const loading = !list.length && (aiLoading || (source !== "ai" && teamState === "loading" && !team));
  const chip = (on: boolean) => `h-8 rounded-pill border px-3 text-[12px] ${on ? "border-[var(--brand-line)] bg-[var(--brand)] text-[var(--brand-ink)]" : "border-[var(--border)] text-text-muted hover:text-text"}`;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text">Calls</h1>
          <p className="max-w-[70ch] text-[12.5px] text-text-muted">
            The AI caller&apos;s calls and the team&apos;s own dialer calls, in one list. Play the recording, read what was said, then open the lead.
          </p>
        </div>
        <button onClick={() => { reloadCalls(); loadTeam(); }} disabled={callsState === "loading" || teamState === "loading"}
          className="flex h-10 items-center gap-2 rounded-soft border border-[var(--border)] px-3 text-[13px] text-text hover:bg-[var(--surface-hover)] disabled:opacity-50">
          {callsState === "loading" || teamState === "loading" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {([["all", "All calls"], ["team", "Team (dialer)"], ["ai", "AI caller"]] as [Source, string][]).map(([v, label]) => (
          <button key={v} onClick={() => setSource(v)} aria-pressed={source === v} className={chip(source === v)}>{label}</button>
        ))}
        {myId && source !== "team" && (["all", "mine"] as const).map((s) => (
          <button key={s} onClick={() => setScope(s)} aria-pressed={scope === s} className={chip(scope === s)}>
            {s === "all" ? "Every lead" : "AI calls to my leads"}
          </button>
        ))}
        {source !== "team" && (
          <label className="ml-auto flex items-center gap-2 text-[12px] text-text-muted">
            <input type="checkbox" checked={hideTests} onChange={(e) => setHideTests(e.target.checked)} /> Hide test calls
          </label>
        )}
      </div>

      {source !== "team" && callsState === "error" && <p className="text-[12.5px] text-accent-red">AI caller history is unavailable right now. Try Refresh in a minute.</p>}
      {source !== "ai" && teamState === "error" && <p className="text-[12.5px] text-accent-red">Team calls could not load. Try Refresh.</p>}

      {aiLoading && !loading && (
        <p className="flex items-center gap-2 text-[12px] text-text-muted"><Loader2 size={13} className="animate-spin" /> Loading the AI caller&apos;s calls…</p>
      )}

      {loading ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-[12.5px] text-text-muted">
          <Loader2 className="animate-spin" size={18} /> Loading calls. The AI caller&apos;s history takes a little while.
        </div>
      ) : (
        <section className="overflow-hidden rounded-panel border border-[var(--border)] bg-surface">
          <ul>
            {list.map((item) => {
              if (item.kind === "team") {
                const c = item.c;
                const who = team?.role === "owner" ? (c.member_id ? names.get(c.member_id) : undefined) : "You";
                return <DialerCallCard key={"t" + c.id} c={c} who={who} onOpenLead={c.target_id ? () => setOpenId(c.target_id) : undefined} />;
              }
              const c = item.c;
              const lead = byPhone.get(tail(c.phone));
              return (
                <li key={"a" + c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border)] px-3 py-2.5 first:border-t-0">
                  <Bot size={16} className="shrink-0 text-text-muted" aria-label="AI caller" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 text-[13px]">
                      <span className="font-medium text-text">{lead?.name || c.phone || "Unknown number"}</span>
                      <span className="text-[11.5px] text-text-muted">AI · {c.agent} · {ist(c.started_at)} · {c.duration}s</span>
                      {c.outcome && <span className="rounded-pill bg-[var(--surface-hover)] px-2 py-0.5 text-[10.5px] text-text">{c.outcome.replace(/_/g, " ")}</span>}
                    </p>
                    {c.summary && <p className="mt-0.5 line-clamp-2 text-[12px] text-text-muted">{c.summary}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={() => setCall(c.id)}
                      className="flex h-8 items-center gap-1.5 rounded-soft border border-[var(--border)] px-2.5 text-[12px] text-text hover:bg-[var(--surface-hover)]">
                      <Play size={13} /> {c.has_audio ? "Listen" : "Details"}
                    </button>
                    {lead && (
                      <button onClick={() => setOpenId(lead.id)} className="h-8 rounded-soft px-2.5 text-[12px] text-text-muted hover:bg-[var(--surface-hover)] hover:text-text">
                        Open lead
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {!list.length && <p className="px-3 py-10 text-center text-[13px] text-text-muted">No calls to show.</p>}
        </section>
      )}

      <LeadModals target={call ? null : open} activity={openId ? byTarget.get(openId) || [] : []} calls={calls} ready={leads?.reportingReady ?? false}
        onClose={() => setOpenId(null)} onSaved={reload} call={call} setCall={setCall} />
    </div>
  );
}
