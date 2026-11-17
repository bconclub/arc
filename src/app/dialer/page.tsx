"use client";

import { useState } from "react";
import { Delete, Loader2, LogOut, Phone, PhoneOff } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { clock, useDialer, useTick, type DialerCallRow } from "@/components/team/Dialer";

/**
 * The dialer, and nothing else: a number pad, Call, and while a call is on,
 * who it is, how long, the recording light and End. Setup and call logs live
 * elsewhere (/team/dialer/setup, /team/calls).
 */
const ACTIVE = ["dialing", "connected"];
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dur = (n: number | null) => (!n ? "" : n >= 60 ? `${Math.floor(n / 60)}m ${n % 60}s` : `${n}s`);

/** My calls: tap one for the recording and the note; the phone calls them back. */
function History({ calls, onCall, canCall }: { calls: DialerCallRow[]; onCall: (c: DialerCallRow) => void; canCall: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!calls.length) return null;
  return (
    <section className="mt-4">
      <h2 className="mb-1 px-1 text-[12px] text-text-muted">Recent calls</h2>
      <ul className="overflow-hidden rounded-panel border border-[var(--border)] bg-surface">
        {calls.map((c) => {
          const missed = c.status === "no_answer" || c.status === "failed";
          const on = open === c.id;
          return (
            <li key={c.id} className="border-t border-[var(--border)] first:border-t-0">
              <div className="flex items-center gap-2 px-3 py-2">
                <button onClick={() => setOpen(on ? null : c.id)} aria-expanded={on} className="flex min-w-0 flex-1 flex-col items-start text-left">
                  <span className={`w-full truncate text-[14px] font-medium ${missed ? "text-accent-red" : "text-text"}`}>{c.target_name || c.phone}</span>
                  <span className="w-full truncate text-[11.5px] text-text-muted">
                    {c.direction === "inbound" ? "Incoming" : "Outgoing"} · {when(c.started_at)}
                    {c.status === "no_answer" ? " · no answer" : c.status === "failed" ? " · failed" : c.duration_secs ? ` · ${dur(c.duration_secs)}` : ""}
                  </span>
                </button>
                <button onClick={() => onCall(c)} disabled={!canCall} aria-label={`Call ${c.target_name || c.phone}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-green text-white disabled:opacity-40"><Phone size={16} /></button>
              </div>
              {on && (
                <div className="flex flex-col gap-2 px-3 pb-3 text-[13px]">
                  {!c.processed_at && !missed ? <p className="text-text-muted">Saving the recording…</p> : null}
                  {c.note && <p className="whitespace-pre-wrap text-text">{c.note}</p>}
                  {c.has_recording && <audio controls preload="none" className="h-9 w-full" src={`/api/agent/dialer/recording/${c.id}`} />}
                  {c.recording_status === "missing" && <p className="text-accent-red">Recording missing.</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function Dialer() {
  const d = useDialer();
  const [phone, setPhone] = useState("");
  const c = d?.current || null;
  const active = Boolean(c && ACTIVE.includes(c.status));
  useTick(active);

  if (!d?.state) return <div className="flex h-screen items-center justify-center bg-[var(--bg)] text-text-muted"><Loader2 className="animate-spin" size={20} /></div>;
  const s = d.state;
  const me = s.me;
  const busy = Boolean(d.starting) || active;
  const digits = phone.replace(/\D/g, "");
  const who = d.starting || c?.target_name || c?.phone || "";
  const connected = c?.status === "connected";
  const saving = Boolean(c && !active && !c.processed_at);
  const status = connected ? clock(c!.answered_at || c!.started_at)
    : busy ? (d.starting || !s.live ? "Your phone is ringing. Pick up." : "PROXe dialing now…")
    : saving ? "Saving the recording…"
    : c && c.status === "no_answer" ? "No answer"
    : c && c.status === "failed" ? (c.error || "Did not go through")
    : c ? "Call saved" : "";
  const mine = s.calls.filter((x) => !me?.id || x.member_id === me.id).filter((x) => !ACTIVE.includes(x.status)).slice(0, 25);
  const key = "flex h-16 items-center justify-center rounded-soft border border-[var(--border)] text-[22px] font-semibold text-text hover:bg-[var(--surface-hover)] active:bg-[var(--surface-hover)]";

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/dialer";
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <header className="flex h-14 items-center gap-2 px-4">
        <span className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-text"><span className="h-2.5 w-2.5 rounded-full bg-[var(--brand)]" /> PROXe Dialer</span>
        <span className="ml-auto text-[12.5px] text-text-muted">{me?.name && me.name !== "You" ? me.name : ""}</span>
        <ThemeToggle />
        <button onClick={logout} aria-label="Log out" className="flex h-9 w-9 items-center justify-center rounded-soft text-text-muted hover:bg-[var(--surface-hover)] hover:text-text"><LogOut size={15} /></button>
      </header>

      <main className="flex flex-1 justify-center px-4 pb-8 pt-4">
        <div className="flex w-full max-w-[360px] flex-col gap-3">
          {busy ? (
            <>
              <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-center">
                <p className="max-w-full truncate text-[26px] font-bold tracking-tight text-text">{who}</p>
                <p aria-live="polite" className={`text-[18px] ${connected ? "font-semibold tabular-nums text-accent-green" : "text-text"}`}>{status}</p>
                {connected
                  ? <p className="flex items-center gap-1.5 text-[12.5px] text-accent-red"><span className="h-2 w-2 animate-pulse rounded-full bg-accent-red" /> Recording</p>
                  : <p className="text-[12.5px] text-text-muted">Stay on the call.</p>}
              </div>
              <button onClick={d.end} disabled={!c} className="flex h-16 items-center justify-center gap-2 rounded-pill bg-accent-red text-[17px] font-semibold text-white disabled:opacity-50">
                <PhoneOff size={20} /> End call
              </button>
            </>
          ) : (
            <>
              <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, "").slice(0, 16))} placeholder="Enter a number" inputMode="tel" aria-label="Number to call"
                className="h-16 w-full rounded-soft border border-[var(--border)] bg-surface px-3 text-center text-[26px] font-semibold tracking-wide text-text outline-none placeholder:text-[15px] placeholder:font-normal placeholder:text-text-muted focus:border-[var(--brand-line)]" />
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "0"].map((k) => (
                  <button key={k} type="button" className={key} onClick={() => setPhone((p) => (p + k).slice(0, 16))}>{k}</button>
                ))}
                <button type="button" className={key} onClick={() => setPhone((p) => p.slice(0, -1))} aria-label="Delete last digit"><Delete size={22} /></button>
              </div>
              <button onClick={() => d.dial({ phone, name: phone })} disabled={digits.length < 10 || !d.ready}
                className="flex h-16 items-center justify-center gap-2 rounded-pill bg-accent-green text-[17px] font-semibold text-white disabled:opacity-40">
                <Phone size={20} /> Call
              </button>
              <p aria-live="polite" className={`min-h-[20px] text-center text-[13px] ${d.message || c?.status === "failed" ? "text-accent-red" : "text-text-muted"}`}>
                {d.message
                  || (!me?.number ? "No company number is set for you yet."
                    : !me.mobile ? "Your mobile is not set yet. Ask the owner to add it."
                    : status)}
              </p>
            </>
          )}
          {!busy && <History calls={mine} canCall={Boolean(d.ready)} onCall={(x) => d.dial(x.target_id ? { id: x.target_id, name: x.target_name || x.phone } : { phone: x.phone, name: x.phone })} />}
        </div>
      </main>
    </div>
  );
}
