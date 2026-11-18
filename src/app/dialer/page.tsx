"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, Delete, History as HistoryIcon, Loader2, LogOut, Phone, PhoneOff, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { clock, Guide, useDialer, useLive, useTick, type DialerCallRow, type LiveLine, type LiveScore } from "@/components/team/Dialer";

/**
 * The dialer. In the middle: the number pad, Call, and while a call is on, who
 * it is, how long, the recording light and End. It never moves. To its right
 * (below, on a phone), sliding in only when there is something to show: who this number is in PROXe and,
 * during a call, the questions to cover and what is being said. My recent
 * calls slide in from the right behind the history button in the header.
 * Setup and full call logs live elsewhere (/team/dialer/setup, /team/calls).
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
              <div key={i}>
                <p className="text-text"><span className={l.who === "lead" ? "font-semibold text-accent-green" : "font-semibold text-text-muted"}>{l.who === "lead" ? "Them" : me}: </span>{l.text}</p>
                {l.en ? <p className="pl-3 text-[12.5px] italic text-text-muted">{l.en}</p> : null}
              </div>
            ))}
            <div ref={end} />
          </div>
        )}
    </section>
  );
}

const STAGE = { value: "Nice to have", problem: "Could fix a problem", pain: "Feels the pain" } as const;

/** How intent-ful and committed this lead is right now, from what they have said on the call. */
function ScoreCard({ score }: { score: LiveScore | null | undefined }) {
  if (!score) {
    return <section className="rounded-panel border border-[var(--border)] bg-surface p-4 text-[13px] text-text-muted">Live score shows once the customer has said a few things.</section>;
  }
  const bar = (label: string, n: number) => (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between"><span className="text-[11.5px] text-text-muted">{label}</span><span className="text-[20px] font-bold tabular-nums text-text">{n}</span></div>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
        <span className={`block h-full rounded-full transition-all ${n >= 65 ? "bg-accent-green" : n >= 35 ? "bg-[var(--brand)]" : "bg-accent-red"}`} style={{ width: `${n}%` }} />
      </span>
    </div>
  );
  return (
    <section className="rounded-panel border border-[var(--border)] bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[12px] font-semibold text-text">Live score</span>
        <span className={`rounded-pill px-2 py-0.5 text-[11.5px] font-semibold ${score.stage === "pain" ? "bg-accent-green text-white" : score.stage === "problem" ? "bg-[var(--brand-soft)] text-[var(--brand-text)]" : "bg-[var(--surface-hover)] text-text-muted"}`}>{STAGE[score.stage]}</span>
        {score.loss ? <span className="ml-auto text-[12.5px] font-semibold text-accent-red">Losing {score.loss.replace(/^losing\s+/i, "")}</span> : null}
      </div>
      <div className="flex gap-4">{bar("Intent", score.intent)}{bar("Commitment", score.commitment)}</div>
      {score.why ? <p className="mt-3 text-[12.5px] text-text-muted">{score.why}</p> : null}
      {score.next ? <p className="mt-1 text-[13px] text-text"><span className="font-semibold">Next: </span>{score.next}</p> : null}
    </section>
  );
}

/** My calls: tap one for the recording and the note; the phone calls them back. */
function History({ calls, onCall, canCall }: { calls: DialerCallRow[]; onCall: (c: DialerCallRow) => void; canCall: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section>
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
  const [history, setHistory] = useState(false);
  // Opened from a lead's Call button in PROXe (/dialer?n=<number>): the number is ready, one tap calls.
  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get("n");
    if (!n) return;
    setPhone(n.replace(/[^\d+ ]/g, "").slice(0, 16));
    window.history.replaceState(null, "", "/dialer");
  }, []);
  useEffect(() => {
    if (!history) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setHistory(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [history]);
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
        <button onClick={() => setHistory(true)} aria-label="Recent calls" title="Recent calls"
          className="flex h-9 w-9 items-center justify-center rounded-soft text-text-muted hover:bg-[var(--surface-hover)] hover:text-text"><HistoryIcon size={16} /></button>
        <ThemeToggle />
        <button onClick={logout} aria-label="Log out" className="flex h-9 w-9 items-center justify-center rounded-soft text-text-muted hover:bg-[var(--surface-hover)] hover:text-text"><LogOut size={15} /></button>
      </header>

      <style>{`@keyframes dialer-side-in{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}`}</style>
      <main className="relative flex w-full flex-1 flex-col items-center gap-6 px-4 pb-8 pt-4">
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

        {(busy || lead || loading) && <div style={{ animation: "dialer-side-in 220ms ease-out" }}
          className="flex w-full max-w-[360px] flex-col gap-3 lg:absolute lg:bottom-4 lg:left-[calc(50%+212px)] lg:top-4 lg:w-[min(440px,calc(50vw-236px))] lg:max-w-none lg:overflow-y-auto lg:pr-1">
          {connected && <ScoreCard score={live?.score} />}
          {busy && c && guide.length > 0 && (
            <section className="rounded-panel border border-[var(--border)] bg-surface p-3">
              <Guide questions={guide} levels={s.guide_levels} callId={c.id} bare covered={live?.covered} />
            </section>
          )}
          <LeadCard lead={lead} loading={loading} />
          {connected && <Transcript lines={live?.lines || []} me={me?.name && me.name !== "You" ? me.name : "You"} />}
        </div>}
      </main>

      {history && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button aria-label="Close recent calls" onClick={() => setHistory(false)} className="absolute inset-0 bg-black/40" />
          <aside role="dialog" aria-label="Recent calls" className="relative flex h-full w-full max-w-[400px] flex-col border-l border-[var(--border)] bg-[var(--bg)] shadow-xl">
            <div className="flex h-14 shrink-0 items-center px-4">
              <h2 className="text-[15px] font-bold tracking-tight text-text">Recent calls</h2>
              <button onClick={() => setHistory(false)} aria-label="Close" className="ml-auto flex h-9 w-9 items-center justify-center rounded-soft text-text-muted hover:bg-[var(--surface-hover)] hover:text-text"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <History calls={mine} canCall={Boolean(d.ready) && !busy} onCall={(x) => { setHistory(false); d.dial(x.target_id ? { id: x.target_id, name: x.target_name || x.phone } : { phone: x.phone, name: x.phone }); }} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
