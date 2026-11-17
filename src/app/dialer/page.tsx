"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, Delete, Loader2, LogOut, Phone, PhoneOff } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { clock, Guide, useDialer, useLive, useTick, type DialerCallRow, type LiveLine } from "@/components/team/Dialer";

/**
 * The dialer. Left: the number pad, Call, and while a call is on, who it is,
 * how long, the recording light and End. Right (below, on a phone): who this
 * number is in PROXe, and either my recent calls or, during a call, the
 * questions to cover and what is being said. Setup and full call logs live
 * elsewhere (/team/dialer/setup, /team/calls).
 */
const ACTIVE = ["dialing", "connected"];
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dur = (n: number | null) => (!n ? "" : n >= 60 ? `${Math.floor(n / 60)}m ${n % 60}s` : `${n}s`);
const label = (k: string) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

type Lead = {
  target: { name: string | null; org: string | null; city: string | null; segment: string | null; status: string | null; why_them: string | null; notes: string | null } | null
  proxe: {
    name: string | null; company: string | null; email: string | null; stage: string | null; temperature: string | null; score: number | null
    status: string | null; source: string | null; last_interaction_at: string | null; booking: string | null; summary: string | null
    notes: { text: string; at: string | null }[]
  } | null
  known: Record<string, string>
  calls: { id: string; started_at: string; note: string | null }[]
};

/** Who this number is: looked up as it is typed, pasted or called. */
function useLead(query: string) {
  const [lead, setLead] = useState<{ q: string; data: Lead } | null>(null);
  useEffect(() => {
    if (!query) return;
    let stop = false;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/team/dialer/context?${query}`, { cache: "no-store" });
        if (r.ok && !stop) setLead({ q: query, data: await r.json() });
      } catch { /* keep the last */ }
    }, 350);
    return () => { stop = true; clearTimeout(t); };
  }, [query]);
  return { lead: query && lead?.q === query ? lead.data : null, loading: Boolean(query) && lead?.q !== query };
}

function LeadCard({ lead, loading }: { lead: Lead | null; loading: boolean }) {
  if (loading) return <section className="rounded-panel border border-[var(--border)] bg-surface p-4 text-[13px] text-text-muted">Looking this number up in PROXe…</section>;
  if (!lead) return null;
  const p = lead.proxe, t = lead.target;
  const name = p?.name || t?.name;
  const company = p?.company || t?.org;
  const known = Object.entries(lead.known || {});
  if (!p && !t && !known.length && !lead.calls.length) {
    return <section className="rounded-panel border border-[var(--border)] bg-surface p-4 text-[13px] text-text-muted">New number. Nothing on it in PROXe yet.</section>;
  }
  const facts = [
    ["Stage", p?.stage || t?.status], ["Interest", p?.temperature], ["Score", p?.score != null ? String(p.score) : null],
    ["Came from", p?.source], ["City", t?.city], ["Segment", t?.segment], ["Booked", p?.booking], ["Email", p?.email],
    ["Last contact", p?.last_interaction_at ? when(p.last_interaction_at) : null],
  ].filter((f): f is [string, string] => Boolean(f[1]));
  return (
    <section className="rounded-panel border border-[var(--border)] bg-surface p-4">
      <p className="text-[17px] font-bold tracking-tight text-text">{name || "Name not known"}</p>
      {company && company !== name ? <p className="text-[13px] text-text-muted">{company}</p> : null}
      {facts.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
          {facts.map(([k, v]) => (
            <div key={k} className="min-w-0"><dt className="text-[11.5px] text-text-muted">{k}</dt><dd className="truncate text-text">{v}</dd></div>
          ))}
        </dl>
      )}
      {p?.summary ? <p className="mt-3 text-[13px] leading-relaxed text-text">{p.summary}</p> : t?.why_them ? <p className="mt-3 text-[13px] leading-relaxed text-text">{t.why_them}</p> : null}
      {known.length > 0 && (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <p className="mb-1 text-[11.5px] text-text-muted">From earlier calls</p>
          <dl className="space-y-1 text-[13px]">
            {known.map(([k, v]) => <div key={k}><dt className="inline text-text-muted">{label(k)}: </dt><dd className="inline text-text">{v}</dd></div>)}
          </dl>
        </div>
      )}
      {p && p.notes.length > 0 && (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <p className="mb-1 text-[11.5px] text-text-muted">Latest notes</p>
          <ul className="space-y-1.5 text-[13px] text-text">
            {p.notes.map((n, i) => <li key={i}>{n.text}{n.at ? <span className="text-text-muted"> · {when(n.at)}</span> : null}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

/** What is being said, newest at the bottom. */
function Transcript({ lines, me }: { lines: LiveLine[]; me: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [lines.length]);
  return (
    <section className="rounded-panel border border-[var(--border)] bg-surface p-4">
      <h2 className="mb-2 text-[12px] text-text-muted">Live transcript</h2>
      {lines.length === 0
        ? <p className="text-[13px] text-text-muted">Listening. Words show here a few seconds after they are said.</p>
        : (
          <div className="max-h-[260px] space-y-1.5 overflow-y-auto text-[13px]">
            {lines.map((l, i) => (
              <p key={i} className="text-text"><span className={l.who === "lead" ? "font-semibold text-accent-green" : "font-semibold text-text-muted"}>{l.who === "lead" ? "Them" : me}: </span>{l.text}</p>
            ))}
            <div ref={end} />
          </div>
        )}
    </section>
  );
}

/** My calls: tap one for the recording and the note; the phone calls them back. */
function History({ calls, onCall, canCall }: { calls: DialerCallRow[]; onCall: (c: DialerCallRow) => void; canCall: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section>
      <h2 className="mb-1 px-1 text-[12px] text-text-muted">Recent calls</h2>
      {!calls.length ? <p className="rounded-panel border border-[var(--border)] bg-surface p-4 text-[13px] text-text-muted">No calls yet. Your calls show here with the recording and the note.</p> : (
        <ul className="overflow-hidden rounded-panel border border-[var(--border)] bg-surface">
          {calls.map((c) => {
            const missed = c.status === "no_answer" || c.status === "failed";
            const on = open === c.id;
            const open_qs = (c.checklist || []).filter((q) => !q.answered).length;
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
                    {open_qs > 0 && <p className="text-text-muted">Not covered: {open_qs} of {(c.checklist || []).length} questions.</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function Dialer() {
  const d = useDialer();
  const [phone, setPhone] = useState("");
  const c = d?.current || null;
  const active = Boolean(c && ACTIVE.includes(c.status));
  useTick(active);
  const digits = phone.replace(/\D/g, "");
  const query = active && c
    ? (c.target_id ? `target_id=${c.target_id}` : `phone=${encodeURIComponent(c.phone)}`)
    : digits.length >= 10 ? `phone=${encodeURIComponent(phone.trim())}` : "";
  const { lead, loading } = useLead(query);
  const live = useLive(c?.id || null, Boolean(c && c.status === "connected"));

  if (!d?.state) return <div className="flex h-screen items-center justify-center bg-[var(--bg)] text-text-muted"><Loader2 className="animate-spin" size={20} /></div>;
  const s = d.state;
  const me = s.me;
  const busy = Boolean(d.starting) || active;
  const who = lead?.proxe?.name || lead?.target?.name || d.starting || c?.target_name || c?.phone || "";
  const connected = c?.status === "connected";
  const saving = Boolean(c && !active && !c.processed_at);
  const status = connected ? clock(c!.answered_at || c!.started_at)
    : busy ? (d.starting || !s.live ? "Your phone is ringing. Pick up." : "PROXe dialing now…")
    : saving ? "Saving the recording…"
    : c && c.status === "no_answer" ? "No answer"
    : c && c.status === "failed" ? (c.error || "Did not go through")
    : c ? "Call saved" : "";
  const mine = s.calls.filter((x) => !me?.id || x.member_id === me.id).filter((x) => !ACTIVE.includes(x.status)).slice(0, 25);
  const guide = s.guide || [];
  const key = "flex h-16 items-center justify-center rounded-soft border border-[var(--border)] text-[22px] font-semibold text-text hover:bg-[var(--surface-hover)] active:bg-[var(--surface-hover)]";
  const clean = (v: string) => v.replace(/[^\d+ ]/g, "").slice(0, 16);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/dialer";
  }
  async function paste() {
    try { setPhone(clean(await navigator.clipboard.readText())); } catch { /* the browser said no: paste into the box instead */ }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <header className="flex h-14 items-center gap-2 px-4">
        <span className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-text"><span className="h-2.5 w-2.5 rounded-full bg-[var(--brand)]" /> PROXe Dialer</span>
        <span className="ml-auto text-[12.5px] text-text-muted">{me?.name && me.name !== "You" ? me.name : ""}</span>
        <ThemeToggle />
        <button onClick={logout} aria-label="Log out" className="flex h-9 w-9 items-center justify-center rounded-soft text-text-muted hover:bg-[var(--surface-hover)] hover:text-text"><LogOut size={15} /></button>
      </header>

      <main className="mx-auto flex w-full max-w-[980px] flex-1 flex-col items-center gap-6 px-4 pb-8 pt-4 lg:flex-row lg:items-start lg:justify-center lg:gap-10">
        <div className="flex w-full max-w-[360px] shrink-0 flex-col gap-3">
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
              <div className="relative">
                <input value={phone} onChange={(e) => setPhone(clean(e.target.value))} placeholder="Type or paste a number" inputMode="tel" aria-label="Number to call"
                  className="h-16 w-full rounded-soft border border-[var(--border)] bg-surface px-12 text-center text-[26px] font-semibold tracking-wide text-text outline-none placeholder:text-[15px] placeholder:font-normal placeholder:text-text-muted focus:border-[var(--brand-line)]" />
                <button type="button" onClick={paste} aria-label="Paste a copied number"
                  className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-soft text-text-muted hover:bg-[var(--surface-hover)] hover:text-text"><ClipboardPaste size={18} /></button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "0"].map((k) => (
                  <button key={k} type="button" className={key} onClick={() => setPhone((p) => (p + k).slice(0, 16))}>{k}</button>
                ))}
                <button type="button" className={key} onClick={() => setPhone((p) => p.slice(0, -1))} aria-label="Delete last digit"><Delete size={22} /></button>
              </div>
              <button onClick={() => d.dial({ phone, name: lead?.proxe?.name || lead?.target?.name || phone })} disabled={digits.length < 10 || !d.ready}
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
        </div>

        <div className="flex w-full max-w-[360px] flex-col gap-3 lg:max-w-[480px] lg:flex-1">
          <LeadCard lead={lead} loading={loading} />
          {busy && c && guide.length > 0 && (
            <section className="rounded-panel border border-[var(--border)] bg-surface p-3">
              <Guide questions={guide} callId={c.id} bare covered={live?.covered} />
            </section>
          )}
          {connected && <Transcript lines={live?.lines || []} me={me?.name && me.name !== "You" ? me.name : "You"} />}
          {!busy && <History calls={mine} canCall={Boolean(d.ready)} onCall={(x) => d.dial(x.target_id ? { id: x.target_id, name: x.target_name || x.phone } : { phone: x.phone, name: x.phone })} />}
        </div>
      </main>
    </div>
  );
}
