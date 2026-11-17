"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ListChecks, Loader2, PhoneCall, PhoneOff, Radio } from "lucide-react";

/**
 * The team dialer, client side. One provider in the team shell: it knows if the
 * person's line is open and what their current call is doing, and gives every
 * page `dial(lead)`. The bar sits above the bottom nav on a phone; during a
 * call it opens the call guide (the questions to get answered).
 */
export type DialerCallRow = {
  id: string; member_id: string | null; target_id: string | null; target_name?: string | null; direction: string; phone: string
  status: "dialing" | "connected" | "ended" | "no_answer" | "failed"; hangup_cause: string | null
  started_at: string; answered_at: string | null; ended_at: string | null; duration_secs: number | null
  recording_status: "pending" | "saved" | "missing" | "none"; has_recording: boolean
  note: string | null; fields: Record<string, string> | null; outcome: string | null
  checklist?: { q: string; answered: boolean; answer: string }[] | null
  processed_at: string | null; proxe_synced_at: string | null; proxe_error: string | null; error: string | null
};
export type DialerState = {
  role: "team" | "owner"; configured: boolean; installed?: boolean
  me?: { id: string; name: string; mobile: string | null; number: string | null; pin_set: boolean } | null
  live?: { since: string } | null
  guide?: string[]
  members?: { id: string; name: string; mobile: string | null; number: string | null; pin_set: boolean; live: boolean }[]
  calls: DialerCallRow[]
};

type Ctx = {
  state: DialerState | null
  ready: boolean                          // this login can dial from a company number
  current: DialerCallRow | null           // the call on the line or just finished
  starting: string | null                 // who is being called, from the tap until the server knows
  dial: (t: { id?: string; phone?: string; name: string }) => Promise<void>
  end: () => Promise<void>
  closeLine: () => Promise<void>
  message: string
  reload: () => void
};
const DialerContext = createContext<Ctx | null>(null);
export const useDialer = () => useContext(DialerContext);

const ACTIVE = ["dialing", "connected"];
const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export function DialerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialerState | null>(null);
  const [message, setMessage] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [watch, setWatch] = useState<string | null>(null); // the call this tab started
  const [starting, setStarting] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/team/dialer?days=7", { cache: "no-store" });
      if (r.ok) setState(await r.json());
    } catch { /* keep the last state */ }
  }, []);

  const myId = state?.me?.id;
  const current = useMemo(() => {
    const calls = (state?.calls || []).filter((c) => !myId || c.member_id === myId);
    const live = calls.find((c) => ACTIVE.includes(c.status));
    if (live) return live;
    return (watch ? calls.find((c) => c.id === watch) : null) || null;
  }, [state, watch, myId]);

  // Poll fast while a call is on or being filed, slowly otherwise.
  useEffect(() => {
    const busy = Boolean(current && (ACTIVE.includes(current.status) || !current.processed_at)) || Boolean(state?.live);
    const hot = Boolean(starting) || Boolean(current && ACTIVE.includes(current.status));
    timer.current = setTimeout(load, hot ? 1500 : busy ? 3000 : 20000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [state, current, starting, load]);
  useEffect(() => { load(); }, [load]);

  const dial = useCallback(async (t: { id?: string; phone?: string; name: string }) => {
    setMessage("");
    setStarting(t.name); // the call screen opens on the tap, not when the server answers
    const r = await post("/api/team/dialer/connect", t.id ? { target_id: t.id } : { phone: t.phone }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { setStarting(null); setMessage(j.error || "Could not start the call."); return; }
    setNames((n) => ({ ...n, [j.id]: t.name }));
    setWatch(j.id);
    await load();
    setStarting(null);
  }, [load]);

  const end = useCallback(async () => {
    if (!current) return;
    await post("/api/team/dialer/end", { id: current.id });
    load();
  }, [current, load]);

  const closeLine = useCallback(async () => {
    await post("/api/team/dialer/line", { action: "close" });
    load();
  }, [load]);

  const ready = Boolean(state?.configured && state.me?.number && (state.me?.mobile || state.live));
  const withName = current && !current.target_name && names[current.id] ? { ...current, target_name: names[current.id] } : current;
  const value: Ctx = { state, ready, current: withName, starting, dial, end, closeLine, message, reload: load };
  return <DialerContext.Provider value={value}>{children}</DialerContext.Provider>;
}

export const clock = (from: string) => {
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(from)) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function useTick(on: boolean) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => set((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [on]);
}

export type LiveLine = { who: "caller" | "lead"; text: string; at: string };

/** What is being said on a call right now, and the questions it has answered. Polled while the call is on. */
export function useLive(callId: string | null, on: boolean) {
  const [live, setLive] = useState<{ id: string; lines: LiveLine[]; covered: Record<string, string> } | null>(null);
  useEffect(() => {
    if (!callId || !on) return;
    let stop = false;
    const pull = async () => {
      try {
        const r = await fetch(`/api/team/dialer/live?c=${callId}`, { cache: "no-store" });
        if (r.ok && !stop) { const j = await r.json(); setLive({ id: callId, lines: j.lines || [], covered: j.covered || {} }); }
      } catch { /* keep the last */ }
    };
    pull();
    const t = setInterval(pull, 2500);
    return () => { stop = true; clearInterval(t); };
  }, [callId, on]);
  return live && live.id === callId ? live : null;
}

/**
 * The questions to get answered on this call. They tick themselves as the
 * customer answers (covered, from the live transcript); a tap overrides.
 */
export function Guide({ questions, callId, bare, covered }: { questions: string[]; callId: string; bare?: boolean; covered?: Record<string, string> }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const isOn = (i: number) => done[callId + i] ?? (covered?.[String(i)] !== undefined);
  const left = questions.filter((_, i) => !isOn(i)).length;
  return (
    <div className={bare ? "w-full" : "mx-auto mb-2 max-w-[1200px] rounded-panel border border-[var(--border)] bg-[var(--bg)] p-3"}>
      <p className="mb-2 text-[11.5px] text-text-muted">
        {left ? `${left} question${left === 1 ? "" : "s"} still to cover before you hang up.` : "All covered. Agree the next step and close."}
      </p>
      <ul className="space-y-1">
        {questions.map((q, i) => {
          const on = isOn(i);
          const answer = covered?.[String(i)];
          return (
            <li key={i}>
              <button onClick={() => setDone((d) => ({ ...d, [callId + i]: !on }))} aria-pressed={on}
                className="flex w-full items-start gap-2 rounded-soft px-2 py-1.5 text-left text-[13px] hover:bg-[var(--surface-hover)]">
                <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border ${on ? "border-accent-green bg-accent-green" : "border-[var(--border)]"}`} />
                <span className="min-w-0">
                  <span className={on ? "text-text-muted line-through" : "text-text"}>{q}</span>
                  {on && answer ? <span className="block text-[12px] text-accent-green">{answer}</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The call screen: covers the page from the tap until the call ends, so there
 * is never a doubt a call is going on. Who, what is happening, the timer, the
 * questions to cover, End. "Hide" drops it to the bar.
 */
export function CallScreen() {
  const d = useDialer();
  const c = d?.current;
  const active = Boolean(c && ACTIVE.includes(c.status));
  const [hidden, setHidden] = useState<string | null>(null);
  useTick(active);
  if (!d?.state) return null;
  const on = Boolean(d.starting) || active;
  const key = c?.id || "starting";
  if (!on || hidden === key) return null;
  const who = d.starting || c?.target_name || c?.phone || "";
  const live = d.state.live;
  const connected = c?.status === "connected";
  const status = connected ? `On call · ${clock(c!.answered_at || c!.started_at)}`
    : d.starting || !live ? "Your phone is ringing. Pick up."
    : "PROXe dialing now…";
  const guide = d.state.guide || [];
  return (
    <div role="dialog" aria-modal="true" aria-label="Call in progress" className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[12px] text-text-muted">From {d.state.me?.number || "company number"} · recorded</span>
        <button onClick={() => setHidden(key)} className="flex h-9 items-center gap-1 rounded-soft px-3 text-[12.5px] text-text-muted hover:bg-[var(--surface-hover)]">
          <ChevronDown size={15} /> Hide
        </button>
      </div>
      <div className="flex flex-col items-center gap-2 px-6 pb-5 pt-4 text-center">
        <span className={`flex h-16 w-16 items-center justify-center rounded-full ${connected ? "bg-accent-green text-white" : "bg-[var(--brand-soft)] text-[var(--brand-text)]"}`}>
          {connected ? <Radio size={26} /> : <Loader2 size={26} className="animate-spin" />}
        </span>
        <p className="max-w-full truncate text-[22px] font-bold tracking-tight text-text">{who}</p>
        <p aria-live="polite" className={`text-[15px] ${connected ? "font-semibold text-accent-green" : "text-text"}`}>{status}</p>
        {!connected && <p className="text-[12.5px] text-text-muted">Stay on the call.</p>}
      </div>
      <div className="mx-auto w-full max-w-[640px] flex-1 overflow-y-auto px-4">
        {guide.length > 0 && c && <Guide questions={guide} callId={c.id} bare />}
      </div>
      <div className="flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4">
        <button onClick={d.end} disabled={!c}
          className="flex h-14 w-full max-w-[320px] items-center justify-center gap-2 rounded-pill bg-accent-red text-[16px] font-semibold text-white disabled:opacity-50">
          <PhoneOff size={18} /> End call
        </button>
      </div>
    </div>
  );
}

/** The strip above the bottom nav: line off / ringing you / on a call / filed. */
export function DialerBar() {
  const d = useDialer();
  const c = d?.current;
  const active = Boolean(c && ACTIVE.includes(c.status));
  const [guideOpen, setGuideOpen] = useState(true);
  useTick(active);
  if (!d?.state || !d.state.me?.number) return null;
  const me = d.state.me;
  const live = d.state.live;
  const who = c?.target_name || c?.phone || "";
  const guide = d.state.guide || [];

  let body: React.ReactNode;
  if (c && c.status === "dialing" && !live) {
    body = <><Loader2 size={15} className="animate-spin" /> <span className="truncate">Your phone is ringing. Pick up.</span></>;
  } else if (c && c.status === "dialing") {
    body = <><Loader2 size={15} className="animate-spin" /> <span className="truncate">PROXe dialing {who} now…</span></>;
  } else if (c && c.status === "connected") {
    body = <><Radio size={15} className="text-accent-green" /> <span className="truncate">On call with {who} · {clock(c.answered_at || c.started_at)}</span></>;
  } else if (c && !c.processed_at) {
    body = <><Loader2 size={15} className="animate-spin" /> <span className="truncate">Saving the recording and note for {who}…</span></>;
  } else if (c) {
    const missed = (c.checklist || []).filter((q) => !q.answered).length;
    const bad = c.recording_status === "missing" || c.proxe_error || c.status === "failed";
    body = (
      <Link href="/team/dialer/setup" className={`truncate ${bad ? "text-accent-red" : ""}`}>
        {c.status === "failed" ? `${who}: ${c.error || "did not go through"}`
          : c.status === "no_answer" ? `${who}: no answer. Logged.`
          : bad ? `${who}: ${c.recording_status === "missing" ? "recording missing" : "not in PROXe yet"}. Open`
          : `${who}: note saved${missed ? `, ${missed} question${missed === 1 ? "" : "s"} not covered` : ""}. Open`}
      </Link>
    );
  } else if (live) {
    body = <><Radio size={15} className="text-accent-green" /> <span className="truncate">Line open. Tap a lead&apos;s phone to call.</span></>;
  } else if (!me.mobile) {
    body = <Link href="/team/dialer/setup" className="truncate underline">Add your mobile on the Dialer page to start calling.</Link>;
  } else {
    body = <span className="truncate text-text-muted">Tap a lead&apos;s phone to call. Your phone rings first; the lead sees {me.number}.</span>;
  }

  return (
    <div className="fixed inset-x-0 bottom-[56px] z-30 border-t border-[var(--border)] bg-surface px-4 py-2 text-[12.5px] text-text md:bottom-0">
      {active && guideOpen && guide.length > 0 && c && <Guide questions={guide} callId={c.id} />}
      <div className="mx-auto flex max-w-[1200px] items-center gap-2">
        <PhoneCall size={14} className="shrink-0 text-text-muted" />
        <span className="flex min-w-0 flex-1 items-center gap-2">{body}</span>
        {d.message && <span className="hidden max-w-[40%] truncate text-accent-red sm:inline">{d.message}</span>}
        {active && guide.length > 0 && (
          <button onClick={() => setGuideOpen((v) => !v)} aria-pressed={guideOpen}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-pill border border-[var(--border)] px-3 text-[12px] text-text">
            <ListChecks size={13} /> Questions
          </button>
        )}
        {active && (
          <button onClick={d.end} className="flex h-8 shrink-0 items-center gap-1.5 rounded-pill bg-accent-red px-3 text-[12px] font-semibold text-white">
            <PhoneOff size={13} /> End
          </button>
        )}
        {!active && live && (
          <button onClick={d.closeLine} className="h-8 shrink-0 rounded-pill border border-[var(--border)] px-3 text-[12px] text-text-muted">Close line</button>
        )}
      </div>
      {d.message && <p className="mx-auto max-w-[1200px] pt-1 text-[12px] text-accent-red sm:hidden">{d.message}</p>}
    </div>
  );
}
