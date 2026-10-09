"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OutreachTarget } from "@/types/ops";
import type { OutreachActivity } from "@/lib/outreach-workflow";
import type { BdrCall } from "@/components/outreach/CallReview";
import { CallReview } from "@/components/outreach/CallReview";
import { LeadDetail } from "@/components/outreach/LeadDetail";

/** Everything the sales pages read: who I am, the leads with their activity, and the AI caller's calls. */
export type Me = { role: "owner" | "team"; me: { id: string; name: string; username: string } | null; members: { id: string; name: string }[] };
type Leads = { targets: OutreachTarget[]; activity: OutreachActivity[]; reportingReady: boolean; inbound_synced_at: string | null; sync_error: string | null };

export function useTeamData({ withCalls = true }: { withCalls?: boolean } = {}) {
  const [me, setMe] = useState<Me | null>(null);
  const [leads, setLeads] = useState<Leads | null>(null);
  const [calls, setCalls] = useState<BdrCall[]>([]);
  const [callsState, setCallsState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");

  const loadLeads = useCallback(async () => {
    try {
      const r = await fetch("/api/team/leads", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Leads could not load.");
      setLeads(j);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  const loadCalls = useCallback(async () => {
    setCallsState("loading");
    try {
      const r = await fetch("/api/outreach/calls", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setCalls(j.calls || []);
      setCallsState("ready");
    } catch {
      setCallsState("error");
    }
  }, []);

  useEffect(() => {
    fetch("/api/team/me").then((r) => (r.ok ? r.json() : null)).then(setMe).catch(() => setMe(null));
    loadLeads();
    // The call history is slow (it reads every call from the provider); it fills in after the leads.
    if (withCalls) loadCalls();
  }, [loadLeads, loadCalls, withCalls]);

  const byTarget = useMemo(() => {
    const m = new Map<string, OutreachActivity[]>();
    for (const a of leads?.activity || []) (m.get(a.target_id) || m.set(a.target_id, []).get(a.target_id)!).push(a);
    return m;
  }, [leads]);

  return { me, leads, calls, callsState, error, byTarget, reload: loadLeads, reloadCalls: loadCalls };
}

export const isOpen = (t: OutreachTarget) => !["won", "lost"].includes(t.status);
export const isInbound = (t: OutreachTarget) => t.source === "proxe_inbound";
export const dueBy = (t: OutreachTarget, day: string) => Boolean(t.next_at && t.next_at.slice(0, 10) <= day && isOpen(t));
export const todayIso = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10); // IST date

/** The lead panel and the call review, opened from any sales page. */
export function LeadModals({
  target, activity, calls, ready, onClose, onSaved, call, setCall,
}: {
  target: Partial<OutreachTarget> | null; activity: OutreachActivity[]; calls: BdrCall[]; ready: boolean
  onClose: () => void; onSaved: () => void; call: string | null; setCall: (id: string | null) => void
}) {
  return (
    <>
      {target && !call && (
        <LeadDetail
          key={target.id || "new"}
          target={target}
          activity={activity}
          calls={calls}
          ready={ready}
          onClose={onClose}
          onSaved={onSaved}
          onCall={(id) => setCall(id)}
        />
      )}
      {call && <CallReview id={call} returnToLead={Boolean(target)} onClose={() => setCall(null)} />}
    </>
  );
}
