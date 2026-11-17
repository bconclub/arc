"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ListChecks, Loader2, PhoneCall, PhoneOff, Radio } from "lucide-react";

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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/team/dialer", { cache: "no-store" });
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
    timer.current = setTimeout(load, busy ? 3000 : 20000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [state, current, load]);
  useEffect(() => { load(); }, [load]);

  const dial = useCallback(async (t: { id?: string; phone?: string; name: string }) => {
    setMessage("");
    const r = await post("/api/team/dialer/connect", t.id ? { target_id: t.id } : { phone: t.phone });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMessage(j.error || "Could not start the call."); return; }
    setNames((n) => ({ ...n, [j.id]: t.name }));
    setWatch(j.id);
    load();
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
  const value: Ctx = { state, ready, current: withName, dial, end, closeLine, message, reload: load };
  return <DialerContext.Provider value={value}>{children}</DialerContext.Provider>;
}

const clock = (from: string) => {
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(from)) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function useTick(on: boolean) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => set((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [on]);
}

/** The questions to get answered on this call; tap one when it is covered. */
function Guide({ questions, callId }: { questions: string[]; callId: string }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const left = questions.filter((_, i) => !done[callId + i]).length;
  return (
    <div className="mx-auto mb-2 max-w-[1200px] rounded-panel border border-[var(--border)] bg-[var(--bg)] p-3">
      <p className="mb-2 text-[11.5px] text-text-muted">
        {left ? `${left} question${left === 1 ? "" : "s"} still to cover before you hang up. Tap one when it is answered.` : "All covered. Agree the next step and close."}
      </p>
      <ul className="space-y-1">
        {questions.map((q, i) => {
          const on = Boolean(done[callId + i]);
          return (
            <li key={i}>
              <button onClick={() => setDone((d) => ({ ...d, [callId + i]: !on }))} aria-pressed={on}
                className={`flex w-full items-start gap-2 rounded-soft px-2 py-1.5 text-left text-[13px] ${on ? "text-text-muted line-through" : "text-text"} hover:bg-[var(--surface-hover)]`}>
                <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border ${on ? "border-accent-green bg-accent-green" : "border-[var(--border)]"}`} />
                {q}
              </button>
            </li>
          );
        })}
      </ul>
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
    body = <><Loader2 size={15} className="animate-spin" /> <span className="truncate">Ringing your phone. Pick up, then {who} is called.</span></>;
  } else if (c && c.status === "dialing") {
    body = <><Loader2 size={15} className="animate-spin" /> <span className="truncate">Ringing {who}…</span></>;
  } else if (c && c.status === "connected") {
    body = <><Radio size={15} className="text-accent-green" /> <span className="truncate">On call with {who} · {clock(c.answered_at || c.started_at)}</span></>;
  } else if (c && !c.processed_at) {
    body = <><Loader2 size={15} className="animate-spin" /> <span className="truncate">Saving the recording and note for {who}…</span></>;
  } else if (c) {
    const missed = (c.checklist || []).filter((q) => !q.answered).length;
    const bad = c.recording_status === "missing" || c.proxe_error || c.status === "failed";
    body = (
      <Link href="/team/dialer" className={`truncate ${bad ? "text-accent-red" : ""}`}>
        {c.status === "failed" ? `${who}: ${c.error || "did not go through"}`
          : c.status === "no_answer" ? `${who}: no answer. Logged.`
          : bad ? `${who}: ${c.recording_status === "missing" ? "recording missing" : "not in PROXe yet"}. Open`
          : `${who}: note saved${missed ? `, ${missed} question${missed === 1 ? "" : "s"} not covered` : ""}. Open`}
      </Link>
    );
  } else if (live) {
    body = <><Radio size={15} className="text-accent-green" /> <span className="truncate">Line open. Tap a lead&apos;s phone to call.</span></>;
  } else if (!me.mobile) {
    body = <Link href="/team/dialer" className="truncate underline">Add your mobile on the Dialer page to start calling.</Link>;
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
