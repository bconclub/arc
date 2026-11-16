"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { useDialer, type DialerCallRow } from "@/components/team/Dialer";

/** One team-dialer call: who, when, how it went, the recording, the note and what was picked up. */
export const ist = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const secs = (n: number | null) => (n == null ? "" : n >= 60 ? `${Math.floor(n / 60)}m ${n % 60}s` : `${n}s`);

export function DialerCallCard({ c, who, onOpenLead }: { c: DialerCallRow; who?: string; onOpenLead?: () => void }) {
  const [open, setOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const d = useDialer();
  const bad = c.recording_status === "missing" || Boolean(c.proxe_error) || Boolean(c.error);
  async function retry() {
    setRetrying(true);
    await fetch(`/api/team/dialer/calls/${c.id}`, { method: "POST" }).catch(() => null);
    setRetrying(false);
    d?.reload();
  }
  return (
    <li className="border-t border-[var(--border)] px-3 py-3 first:border-t-0">
      <div className="flex items-start gap-3">
        {c.direction === "inbound" ? <PhoneIncoming size={16} className="mt-0.5 shrink-0 text-text-muted" /> : <PhoneOutgoing size={16} className="mt-0.5 shrink-0 text-text-muted" />}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-[13.5px] font-medium text-text">
            {c.target_name || c.phone}
            <span className="text-[11.5px] font-normal text-text-muted">
              {ist(c.started_at)}{c.duration_secs ? ` · ${secs(c.duration_secs)}` : ""}{who ? ` · ${who}` : ""}
            </span>
          </p>
          <p className={`text-[12px] ${bad ? "text-accent-red" : "text-text-muted"}`}>
            {["dialing", "connected"].includes(c.status) ? (c.status === "dialing" ? "Ringing…" : "On the call")
              : !c.processed_at ? "Saving the recording and note…"
              : c.status === "no_answer" ? "No answer. Logged on the lead."
              : c.status === "failed" ? `Did not go through${c.error ? ": " + c.error : ""}`
              : c.recording_status === "missing" ? "Recording missing. Log the call by hand on the lead."
              : c.proxe_error ? `Saved in ARC, not in PROXe: ${c.proxe_error}`
              : "Recorded, note saved to the lead in PROXe."}
          </p>
          {c.note && c.processed_at && <p className="mt-1 whitespace-pre-wrap text-[13px] text-text">{c.note}</p>}
          {c.has_recording && (
            <audio controls preload="none" className="mt-2 h-9 w-full max-w-md" src={`/api/agent/dialer/recording/${c.id}`} />
          )}
          <div className="mt-1 flex flex-wrap gap-3 text-[12px]">
            {c.fields && Object.keys(c.fields).length > 0 && (
              <button onClick={() => setOpen((v) => !v)} className="text-[var(--brand-text)] underline">{open ? "Hide details" : "Details picked up"}</button>
            )}
            {onOpenLead && <button onClick={onOpenLead} className="text-text-muted underline">Open lead</button>}
            {c.processed_at && bad && c.status === "ended" && (
              <button onClick={retry} disabled={retrying} className="text-text-muted underline">{retrying ? "Retrying…" : "Retry"}</button>
            )}
          </div>
          {open && c.fields && (
            <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-2">
              {Object.entries(c.fields).map(([k, v]) => (
                <div key={k} className="flex gap-2"><dt className="shrink-0 capitalize text-text-muted">{k.replace(/_/g, " ")}</dt><dd className="text-text">{v}</dd></div>
              ))}
            </dl>
          )}
        </div>
        {!bad && c.processed_at && c.status === "ended" && <CheckCircle2 size={16} className="shrink-0 text-accent-green" />}
        {bad && c.processed_at && <AlertTriangle size={16} className="shrink-0 text-accent-red" />}
      </div>
    </li>
  );
}

