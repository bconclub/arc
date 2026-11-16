"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { useDialer, type DialerCallRow } from "@/components/team/Dialer";

/**
 * The team dialer: how to open your line, and every call you made in the last
 * day and a half with its recording, the note and what was picked up. The owner
 * also sets each person's mobile, company number and passcode here, and sees
 * everyone's calls.
 */
const ist = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const secs = (n: number | null) => (n == null ? "" : n >= 60 ? `${Math.floor(n / 60)}m ${n % 60}s` : `${n}s`);

function CallCard({ c, who }: { c: DialerCallRow; who?: string }) {
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

function Setup({ m, onSaved }: { m: { id: string; name: string; mobile: string | null; number: string | null; pin_set: boolean; live: boolean }; onSaved: () => void }) {
  const [mobile, setMobile] = useState(m.mobile || "");
  const [number, setNumber] = useState(m.number || "");
  const [pin, setPin] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setNote("");
    const r = await fetch("/api/team/dialer/setup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: m.id, mobile, number, ...(pin ? { pin } : {}) }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setNote(r.ok ? "Saved." : j.error || "Could not save.");
    if (r.ok) { setPin(""); onSaved(); }
  }
  const input = "h-9 rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-text outline-none focus:border-[var(--brand-line)]";
  return (
    <li className="flex flex-col gap-2 border-t border-[var(--border)] px-3 py-3 first:border-t-0">
      <p className="text-[13.5px] font-medium text-text">{m.name} <span className="text-[11.5px] font-normal text-text-muted">{m.live ? "· line open" : ""}{m.pin_set ? " · passcode set" : " · no passcode"}</span></p>
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-[11.5px] text-text-muted">Their mobile (dials in)<input className={input} value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="98xxxxxxxx" inputMode="tel" /></label>
        <label className="flex flex-col gap-1 text-[11.5px] text-text-muted">Company number (Vobiz)<input className={input} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="+9180xxxxxxxx" inputMode="tel" /></label>
        <label className="flex flex-col gap-1 text-[11.5px] text-text-muted">New passcode (6 digits)<input className={input} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={m.pin_set ? "unchanged" : "e.g. 482913"} inputMode="numeric" type="password" autoComplete="new-password" /></label>
        <button onClick={save} disabled={busy} className="mt-auto h-9 rounded-soft bg-[var(--brand)] px-4 text-[13px] font-semibold text-[var(--brand-ink)] disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
      </div>
      {note && <p className="text-[12px] text-text-muted">{note}</p>}
    </li>
  );
}

export default function TeamDialer() {
  const d = useDialer();
  const s = d?.state;
  if (!s) return <div className="flex h-40 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={18} /></div>;
  const names = new Map((s.members || []).map((m) => [m.id, m.name]));

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-text">Dialer</h1>
        <p className="text-[12.5px] text-text-muted">
          Call leads from the company number, never your own. Every call is recorded, and the note goes to the lead in PROXe.
        </p>
      </header>

      {s.installed === false ? (
        <p className="rounded-panel border border-[var(--border)] bg-surface p-3 text-[13px] text-text-muted">The dialer is being set up. It opens here once its database tables are in.</p>
      ) : !s.configured && (
        <p className="rounded-panel border border-[var(--border)] bg-surface p-3 text-[13px] text-accent-red">The dialer is not connected to Vobiz yet.</p>
      )}

      {s.role === "team" && s.me && (
        <section className="rounded-panel border border-[var(--border)] bg-surface p-4 text-[13px] text-text">
          {!s.me.number || !s.me.pin_set ? (
            <p>Your dialer is not set up yet. The owner sets your company number and passcode.</p>
          ) : s.live ? (
            <p><span className="font-semibold text-accent-green">Your line is open</span> since {ist(s.live.since)}. Tap the phone on any lead to call it. Stay on the line between calls; hang up when you are done for the day.</p>
          ) : (
            <ol className="list-decimal space-y-1 pl-5">
              <li>From {s.me.mobile ? <b>{s.me.mobile}</b> : "your registered mobile"}, call <a className="font-semibold underline" href={"tel:" + s.me.number}>{s.me.number}</a>.</li>
              <li>Enter your passcode and press #. Stay on the line.</li>
              <li>Tap the phone on a lead. They ring from the company number and join you.</li>
              <li>Open with: &quot;Hi, this is {s.me.name.split(" ")[0]} from PROXe. Just so you know, this call is recorded for quality. Is now a good time?&quot;</li>
            </ol>
          )}
        </section>
      )}

      {s.role === "owner" && (
        <section className="overflow-hidden rounded-panel border border-[var(--border)] bg-surface">
          <p className="border-b border-[var(--border)] px-3 py-2 text-[11.5px] text-text-muted">Who can dial. The passcode is stored hashed and never shown again.</p>
          <ul>{(s.members || []).map((m) => <Setup key={m.id} m={m} onSaved={d.reload} />)}</ul>
        </section>
      )}

      <section className="overflow-hidden rounded-panel border border-[var(--border)] bg-surface">
        <p className="border-b border-[var(--border)] px-3 py-2 text-[11.5px] text-text-muted">{s.calls.length} call{s.calls.length === 1 ? "" : "s"} in the last 36 hours</p>
        <ul>{s.calls.map((c) => <CallCard key={c.id} c={c} who={s.role === "owner" && c.member_id ? names.get(c.member_id) : undefined} />)}</ul>
        {!s.calls.length && <p className="px-3 py-10 text-center text-[13px] text-text-muted">No calls yet.</p>}
      </section>
    </div>
  );
}
