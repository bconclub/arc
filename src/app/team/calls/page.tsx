"use client";

import { useMemo, useState } from "react";
import { Loader2, Play, RefreshCw } from "lucide-react";
import type { OutreachTarget } from "@/types/ops";
import { LeadModals, useTeamData } from "@/components/team/useTeamData";

/**
 * The AI caller's calls: listen, read the transcript, and pick up the warm
 * ones. Each call is matched to a lead by phone, so "Open lead" goes straight
 * to logging the human follow-up. No costs here; those stay with the owner.
 */
const tail = (p?: string | null) => (p || "").replace(/\D/g, "").slice(-10);
const ist = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function TeamCalls() {
  const { me, leads, calls, callsState, byTarget, reload, reloadCalls } = useTeamData();
  const [scope, setScope] = useState<"mine" | "all">("all");
  const [hideTests, setHideTests] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [call, setCall] = useState<string | null>(null);

  const byPhone = useMemo(() => {
    const m = new Map<string, OutreachTarget>();
    for (const t of leads?.targets || []) if (tail(t.phone).length === 10) m.set(tail(t.phone), t);
    return m;
  }, [leads]);
  const myId = me?.me?.id;
  const list = calls
    .filter((c) => !(hideTests && c.is_test))
    .filter((c) => scope === "all" || byPhone.get(tail(c.phone))?.owner_id === myId);
  const open: Partial<OutreachTarget> | null = leads?.targets.find((t) => t.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text">AI calls</h1>
          <p className="max-w-[70ch] text-[12.5px] text-text-muted">
            Every call the AI caller made. Play the recording, read what was said, then open the lead to follow up yourself.
          </p>
        </div>
        <button onClick={reloadCalls} disabled={callsState === "loading"}
          className="flex h-10 items-center gap-2 rounded-soft border border-[var(--border)] px-3 text-[13px] text-text hover:bg-[var(--surface-hover)] disabled:opacity-50">
          {callsState === "loading" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {myId && (["all", "mine"] as const).map((s) => (
          <button key={s} onClick={() => setScope(s)} aria-pressed={scope === s}
            className={`h-8 rounded-pill border px-3 text-[12px] ${scope === s ? "border-[var(--brand-line)] bg-[var(--brand)] text-[var(--brand-ink)]" : "border-[var(--border)] text-text-muted hover:text-text"}`}>
            {s === "all" ? "All calls" : "Calls to my leads"}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-[12px] text-text-muted">
          <input type="checkbox" checked={hideTests} onChange={(e) => setHideTests(e.target.checked)} /> Hide test calls
        </label>
      </div>

      {callsState === "loading" && !calls.length ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-[12.5px] text-text-muted">
          <Loader2 className="animate-spin" size={18} /> Loading every call from the calling service. This takes a little while.
        </div>
      ) : callsState === "error" ? (
        <p className="text-[13px] text-accent-red">Call history is unavailable right now. Try Refresh in a minute.</p>
      ) : (
        <section className="overflow-hidden rounded-panel border border-[var(--border)] bg-surface">
          <ul>
            {list.map((c) => {
              const lead = byPhone.get(tail(c.phone));
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border)] px-3 py-2.5 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 text-[13px]">
                      <span className="font-medium text-text">{lead?.name || c.phone || "Unknown number"}</span>
                      <span className="text-[11.5px] text-text-muted">{c.agent} · {ist(c.started_at)} IST · {c.duration}s</span>
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
