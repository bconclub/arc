"use client";

import { useState } from "react";
import { Loader2, Phone } from "lucide-react";
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
        <label className="flex flex-col gap-1 text-[11.5px] text-text-muted">Their mobile (the dialer rings it)<input className={input} value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="98xxxxxxxx" inputMode="tel" /></label>
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

const inputCls = "h-9 rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-text outline-none focus:border-[var(--brand-line)]";
const post = (body: unknown) => fetch("/api/team/dialer/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Your own mobile (the phone the dialer rings) and, if you want to dial in instead, a passcode. */
function Mine({ me, onSaved }: { me: { mobile: string | null; number: string | null; pin_set: boolean }; onSaved: () => void }) {
  const [mobile, setMobile] = useState(me.mobile || "");
  const [pin, setPin] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setNote("");
    const r = await post({ mobile, ...(pin ? { pin } : {}) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setNote(r.ok ? "Saved." : j.error || "Could not save.");
    if (r.ok) { setPin(""); onSaved(); }
  }
  return (
    <div className="flex flex-col gap-1 border-t border-[var(--border)] pt-3">
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-[11.5px] text-text-muted">Your mobile (the dialer rings it)<input className={inputCls} value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="98xxxxxxxx" inputMode="tel" /></label>
        <label className="flex flex-col gap-1 text-[11.5px] text-text-muted">Passcode, optional (6 digits)<input className={inputCls} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={me.pin_set ? "unchanged" : "only to dial in"} inputMode="numeric" type="password" autoComplete="new-password" /></label>
        <button onClick={save} disabled={busy} className="mt-auto h-9 rounded-soft bg-[var(--brand)] px-4 text-[13px] font-semibold text-[var(--brand-ink)] disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
      </div>
      <p className="text-[11.5px] text-text-muted">{note || (me.pin_set && me.number ? `You can also open your line by calling ${me.number} from this mobile and entering your passcode.` : "The passcode is only needed if you want to open your line by calling the company number yourself.")}</p>
    </div>
  );
}

/** The keypad: type any number and call it from the company number. */
function Pad() {
  const d = useDialer();
  const [phone, setPhone] = useState("");
  if (!d) return null;
  const busy = Boolean(d.starting) || Boolean(d.current && ["dialing", "connected"].includes(d.current.status));
  const digits = phone.replace(/\D/g, "");
  const key = "flex h-14 items-center justify-center rounded-soft border border-[var(--border)] text-[20px] font-semibold text-text hover:bg-[var(--surface-hover)] active:bg-[var(--surface-hover)]";
  return (
    <div className="mx-auto flex w-full max-w-[320px] flex-col gap-2">
      <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, "").slice(0, 16))} placeholder="Enter a number" inputMode="tel" aria-label="Number to call"
        className="h-14 w-full rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 text-center text-[24px] font-semibold tracking-wide text-text outline-none placeholder:text-[15px] placeholder:font-normal placeholder:text-text-muted focus:border-[var(--brand-line)]" />
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "0"].map((k) => (
          <button key={k} type="button" className={key} onClick={() => setPhone((p) => (p + k).slice(0, 16))}>{k}</button>
        ))}
        <button type="button" className={key + " text-[14px] font-normal text-text-muted"} onClick={() => setPhone((p) => p.slice(0, -1))} aria-label="Delete last digit">Delete</button>
      </div>
      <button onClick={() => d.dial({ phone, name: phone })} disabled={busy || digits.length < 10 || !d.ready}
        className="flex h-14 items-center justify-center gap-2 rounded-pill bg-accent-green text-[16px] font-semibold text-white disabled:opacity-40">
        <Phone size={18} /> Call
      </button>
      {!d.ready && <p className="text-center text-[12px] text-text-muted">Save your mobile below first.</p>}
      {d.message && <p className="text-center text-[12px] text-accent-red">{d.message}</p>}
    </div>
  );
}

/** The call guide: the questions to get answered on every call. The owner edits it. */
function GuideBox({ guide, owner, onSaved }: { guide: string[]; owner: boolean; onSaved: () => void }) {
  const [text, setText] = useState(guide.join("\n"));
  const [note, setNote] = useState("");
  async function save() {
    setNote("");
    const r = await post({ guide: text.split("\n") });
    setNote(r.ok ? "Saved. New calls use it." : "Could not save.");
    if (r.ok) onSaved();
  }
  return (
    <section className="rounded-panel border border-[var(--border)] bg-surface p-4">
      <h2 className="text-[14px] font-semibold text-text">Call guide</h2>
      <p className="mb-2 text-[12px] text-text-muted">Get these answered before you hang up. They show on screen during the call, and each call is checked against them afterwards.</p>
      {owner ? (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.max(6, guide.length + 1)} aria-label="Call guide, one question per line"
            className="w-full rounded-soft border border-[var(--border)] bg-[var(--bg)] p-3 text-[13px] text-text outline-none focus:border-[var(--brand-line)]" />
          <div className="mt-2 flex items-center gap-3">
            <button onClick={save} className="h-9 rounded-soft bg-[var(--brand)] px-4 text-[13px] font-semibold text-[var(--brand-ink)]">Save guide</button>
            <span className="text-[12px] text-text-muted">{note || "One question per line."}</span>
          </div>
        </>
      ) : (
        <ol className="list-decimal space-y-1 pl-5 text-[13px] text-text">{guide.map((q, i) => <li key={i}>{q}</li>)}</ol>
      )}
    </section>
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
        <h1 className="text-[22px] font-bold tracking-tight text-text">Dialer setup and call logs</h1>
        <p className="text-[12.5px] text-text-muted">
          Your mobile, the call guide and every call with its recording. To make calls, open the <a href="/dialer" className="underline">Dialer</a>.
        </p>
      </header>

      {s.installed === false ? (
        <p className="rounded-panel border border-[var(--border)] bg-surface p-3 text-[13px] text-text-muted">The dialer is being set up. It opens here once its database tables are in.</p>
      ) : !s.configured && (
        <p className="rounded-panel border border-[var(--border)] bg-surface p-3 text-[13px] text-accent-red">The dialer is not connected to Vobiz yet.</p>
      )}

      {s.me && s.installed !== false && (
        <section className="flex flex-col gap-3 rounded-panel border border-[var(--border)] bg-surface p-4 text-[13px] text-text">
          {!s.me.number ? (
            <p>You have no company number yet. The owner sets it below.</p>
          ) : (
            <>
              <Pad />
              {s.live ? (
                <p><span className="font-semibold text-accent-green">Your line is open</span> since {ist(s.live.since)}. Tap the phone on any lead to call it. Stay on the line between calls.</p>
              ) : (
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Type a number above, or tap the phone on a lead. <b>Your own phone rings first</b>: pick up.</li>
                  <li>The lead is then called from <b>{s.me.number}</b> and joins you. They never see your number.</li>
                  <li>When they hang up, stay on the line and tap the next lead.</li>
                  <li>Open with: &quot;Hi, this is {s.me.name === "You" ? "(your name)" : s.me.name.split(" ")[0]} from PROXe. Just so you know, this call is recorded for quality. Is now a good time?&quot;</li>
                </ol>
              )}
              <Mine me={s.me} onSaved={d.reload} />
            </>
          )}
        </section>
      )}

      {s.guide && s.installed !== false && <GuideBox guide={s.guide} owner={s.role === "owner"} onSaved={d.reload} />}

      {s.role === "owner" && (
        <section className="overflow-hidden rounded-panel border border-[var(--border)] bg-surface">
          <p className="border-b border-[var(--border)] px-3 py-2 text-[11.5px] text-text-muted">Who can dial. Owner is you. The passcode is stored hashed and never shown again.</p>
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
