"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, PhoneCall, PhoneOff, Radio } from "lucide-react";

/**
 * The team dialer, client side. One provider in the team shell: it knows if the
 * person's line is open and what their current call is doing, and gives every
 * page `dial(lead)`. The bar sits above the bottom nav on a phone.
 */
export type DialerCallRow = {
  id: string; member_id: string | null; target_id: string | null; target_name?: string | null; direction: string; phone: string
  status: "dialing" | "connected" | "ended" | "no_answer" | "failed"; hangup_cause: string | null
  started_at: string; answered_at: string | null; ended_at: string | null; duration_secs: number | null
  recording_status: "pending" | "saved" | "missing" | "none"; has_recording: boolean
  note: string | null; fields: Record<string, string> | null; outcome: string | null
  processed_at: string | null; proxe_synced_at: string | null; proxe_error: string | null; error: string | null
};
export type DialerState = {
  role: "team" | "owner"; configured: boolean; installed?: boolean
  me?: { id: string; name: string; mobile: string | null; number: string | null; pin_set: boolean }
  live?: { since: string } | null
  members?: { id: string; name: string; mobile: string | null; number: string | null; pin_set: boolean; live: boolean }[]
  calls: DialerCallRow[]
};

type Ctx = {
  state: DialerState | null
  ready: boolean                          // this login can dial from a company number
  current: DialerCallRow | null           // the call on the line or just finished
  dial: (t: { id: string; name: string }) => Promise<void>
  end: () => Promise<void>
  message: string
  reload: () => void
};
const DialerContext = createContext<Ctx | null>(null);
export const useDialer = () => useContext(DialerContext);

const ACTIVE = ["dialing", "connected"];

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

  const current = useMemo(() => {
    const calls = state?.calls || [];
    const live = calls.find((c) => ACTIVE.includes(c.status));
    if (live) return live;
    const w = watch ? calls.find((c) => c.id === watch) : null;
    return w || null;
  }, [state, watch]);

  // Poll fast while a call is on or being filed, slowly otherwise.
  useEffect(() => {
    const busy = Boolean(current && (ACTIVE.includes(current.status) || !current.processed_at)) || Boolean(state?.live);
    timer.current = setTimeout(load, busy ? 3000 : 20000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [state, current, load]);
  useEffect(() => { load(); }, [load]);

  const dial = useCallback(async (t: { id: string; name: string }) => {
    setMessage("");
    setNames((n) => ({ ...n, [t.id]: t.name }));
    const r = await fetch("/api/team/dialer/connect", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target_id: t.id }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMessage(j.error || "Could not start the call."); return; }
    setWatch(j.id);
    load();
  }, [load]);

  const end = useCallback(async () => {
    if (!current) return;
    await fetch("/api/team/dialer/end", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: current.id }) });
    load();
  }, [current, load]);

  const ready = state?.role === "team" && state.configured && Boolean(state.me?.number && state.me?.pin_set);
  const withName = current && current.target_id && names[current.target_id] ? { ...current, target_name: current.target_name || names[current.target_id] } : current;
  const value: Ctx = { state, ready, current: withName, dial, end, message, reload: load };
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

/** The strip above the bottom nav: line off / line open / on a call / filed. */
export function DialerBar() {
  const d = useDialer();
  const c = d?.current;
  useTick(Boolean(c && ACTIVE.includes(c.status)));
  if (!d?.state || d.state.role !== "team" || !d.state.me?.number) return null;
  const me = d.state.me;
  const live = d.state.live;
  const who = c?.target_name || c?.phone || "";

  let body: React.ReactNode;
  if (c && c.status === "dialing") {
    body = <><Loader2 size={15} className="animate-spin" /> <span className="truncate">Ringing {who}…</span></>;
  } else if (c && c.status === "connected") {
    body = <><Radio size={15} className="text-accent-green" /> <span className="truncate">On call with {who} · {clock(c.answered_at || c.started_at)}</span></>;
  } else if (c && !c.processed_at) {
    body = <><Loader2 size={15} className="animate-spin" /> <span className="truncate">Saving the recording and note for {who}…</span></>;
  } else if (c) {
    const bad = c.recording_status === "missing" || c.proxe_error;
    body = (
      <Link href="/team/dialer" className={`truncate ${bad ? "text-accent-red" : ""}`}>
        {c.status === "no_answer" ? `${who}: no answer. Logged.` : bad ? `${who}: ${c.recording_status === "missing" ? "recording missing" : "not in PROXe yet"}. Open` : `${who}: note saved to the lead. Open`}
      </Link>
    );
  } else if (live) {
    body = <><Radio size={15} className="text-accent-green" /> <span className="truncate">Line open. Tap a lead&apos;s phone to call.</span></>;
  } else {
    body = (
      <a href={"tel:" + me.number} className="truncate underline">
        Line off. Call {me.number} from {me.mobile ? "your phone" : "your registered phone"} and enter your passcode.
      </a>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-[56px] z-30 border-t border-[var(--border)] bg-surface px-4 py-2 text-[12.5px] text-text md:bottom-0">
      <div className="mx-auto flex max-w-[1200px] items-center gap-2">
        <PhoneCall size={14} className="shrink-0 text-text-muted" />
        <span className="flex min-w-0 flex-1 items-center gap-2">{body}</span>
        {d.message && <span className="hidden max-w-[40%] truncate text-accent-red sm:inline">{d.message}</span>}
        {c && ACTIVE.includes(c.status) && (
          <button onClick={d.end} className="flex h-8 shrink-0 items-center gap-1.5 rounded-pill bg-accent-red px-3 text-[12px] font-semibold text-white">
            <PhoneOff size={13} /> End
          </button>
        )}
      </div>
      {d.message && <p className="mx-auto max-w-[1200px] pt-1 text-[12px] text-accent-red sm:hidden">{d.message}</p>}
    </div>
  );
}
