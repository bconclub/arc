"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useDialer } from "@/components/team/Dialer";
import { DialerCallCard as CallCard, ist } from "@/components/team/DialerCallCard";

/**
 * The team dialer: how to open your line, and every call you made in the last
 * day and a half with its recording, the note and what was picked up. The owner
 * also sets each person's mobile, company number and passcode here, and sees
 * everyone's calls.
 */

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
  async function connect() {
    if (!window.confirm(`Send every incoming call on ${m.number} to the team dialer? Only do this for a number nothing else uses.`)) return;
    setBusy(true); setNote("");
    const r = await fetch("/api/team/dialer/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ member_id: m.id, connect: true }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setNote(r.ok ? `${j.number} now rings the dialer.` : j.error || "Could not connect.");
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
        {m.number && (
          <button onClick={connect} disabled={busy} className="mt-auto h-9 rounded-soft border border-[var(--border)] px-3 text-[13px] text-text disabled:opacity-50">Connect number to dialer</button>
        )}
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
