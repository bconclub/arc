"use client";

import { Phone } from "lucide-react";
import type { OutreachTarget } from "@/types/ops";
import { outcomeLabel } from "@/lib/outreach-workflow";
import { StatusPill, type Tone } from "@/components/ui/StatusPill";
import { dueBy, isInbound, todayIso } from "./useTeamData";

const STAGE_TONE: Record<string, Tone> = {
  identified: "neutral", researched: "neutral", drafted: "info", sent: "info", replied: "warn",
  meeting: "brand", won: "good", lost: "bad", no_reply: "neutral",
};

const when = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** One lead in a list: who, where from, stage, follow-up, owner. Tap to open; the phone dials. */
export function LeadRow({ t, owner, lastWork, onOpen }: { t: OutreachTarget; owner: string | null; lastWork?: string; onOpen: () => void }) {
  const due = dueBy(t, todayIso());
  const inbound = isInbound(t);
  return (
    <li className="flex items-center gap-3 border-t border-[var(--border)] px-3 py-2.5 first:border-t-0 hover:bg-[var(--surface-hover)]">
      <button onClick={onOpen} className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
        <span className="flex w-full min-w-0 items-center gap-2">
          <span className="truncate text-[13.5px] font-medium text-text">{t.name}</span>
          <span className={`shrink-0 rounded-pill px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${inbound ? "bg-[var(--brand-soft)] text-[var(--brand-text)]" : "bg-[var(--surface-hover)] text-text-muted"}`}>
            {inbound ? `Inbound${t.inbound?.channel ? " · " + t.inbound.channel : ""}` : "Outbound"}
          </span>
        </span>
        <span className="w-full truncate text-[11.5px] text-text-muted">
          {[t.org, t.segment, t.city].filter(Boolean).join(" · ") || (inbound && t.inbound?.stage ? "PROXe: " + t.inbound.stage : "")}
          {lastWork ? `${t.org || t.segment || t.city ? " · " : ""}${lastWork}` : ""}
        </span>
      </button>
      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
        <StatusPill status={outcomeLabel(t.status)} tone={STAGE_TONE[t.status]} />
        <span className={`text-[11px] ${due ? "font-semibold text-accent-red" : "text-text-muted"}`}>
          {t.next_at ? `${due ? "Due " : "Follow up "}${when(t.next_at)}` : owner || "Unassigned"}
        </span>
      </div>
      {t.phone ? (
        <a href={"tel:" + t.phone} aria-label={"Call " + t.name}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-text hover:border-[var(--brand-line)]">
          <Phone size={15} />
        </a>
      ) : <span className="h-9 w-9 shrink-0" />}
    </li>
  );
}
