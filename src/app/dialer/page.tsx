"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Delete, Loader2, LogOut, Phone, PhoneOff, Search } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Guide, clock, useDialer, useTick } from "@/components/team/Dialer";
import type { OutreachTarget } from "@/types/ops";

/**
 * The dialer workspace: one screen to come in and call from.
 * Right: the dialer (keypad, call status, End). Left: who you are calling
 * (what PROXe and earlier calls know), the questions to cover, and, when
 * nothing is on, your leads to pick from. Logs live on /team/dialer.
 */
type Pick = { id?: string; phone: string; name: string };
type Context = {
  target: (Partial<OutreachTarget> & { qualification_note?: string | null }) | null
  known: Record<string, string>
  activity: { channel: string; outcome: string; worker: string; occurred_at: string; summary: string }[]
  calls: { id: string; started_at: string; duration_secs: number | null; outcome: string | null; note: string | null; has_recording: boolean; checklist: { q: string; answered: boolean; answer: string }[] | null }[]
};

const ACTIVE = ["dialing", "connected"];
const tail = (p?: string | null) => (p || "").replace(/\D/g, "").slice(-10);
const day = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const card = "rounded-panel border border-[var(--border)] bg-surface";

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex gap-3 py-1 text-[13px]">
      <dt className="w-28 shrink-0 capitalize text-text-muted">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap break-words text-text">{value}</dd>
    </div>
  );
}

/** What we know about the person on the line. */
function Known({ pick, ctx, loading }: { pick: Pick; ctx: Context | null; loading: boolean }) {
  const t = ctx?.target;
  const inbound = t?.inbound;
  const nothing = ctx && !t && !Object.keys(ctx.known).length && !ctx.calls.length;
  return (
    <section className={`${card} p-4`}>
      <h2 className="text-[18px] font-bold tracking-tight text-text">{t?.name || pick.name}</h2>
      <p className="text-[12.5px] text-text-muted">{[t?.org, t?.segment, t?.city].filter(Boolean).join(" · ") || pick.phone}</p>
      {loading && !ctx ? (
        <p className="mt-3 flex items-center gap-2 text-[12.5px] text-text-muted"><Loader2 size={13} className="animate-spin" /> Looking them up…</p>
      ) : nothing ? (
        <p className="mt-3 text-[13px] text-text-muted">New number. Nothing on file yet: this call starts their record.</p>
      ) : ctx && (
        <dl className="mt-3">
          <Row label="Stage" value={inbound?.stage ? `${inbound.stage}${inbound.score != null ? ` · score ${inbound.score}` : ""}` : t?.status} />
          <Row label="Came from" value={inbound?.channel ? `Inbound · ${inbound.channel}` : t?.source} />
          <Row label="Booking" value={inbound?.booking} />
          <Row label="Follow up" value={t?.next_at ? day(t.next_at) : null} />
          <Row label="Why them" value={t?.why_them} />
          <Row label="Research" value={t?.research?.slice(0, 600)} />
          <Row label="Notes" value={(t?.qualification_note || t?.notes)?.slice(0, 600)} />
          {Object.entries(ctx.known).map(([k, v]) => <Row key={k} label={k.replace(/_/g, " ")} value={v} />)}
        </dl>
      )}
      {ctx && (ctx.calls.length > 0 || ctx.activity.length > 0) && (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <p className="mb-1 text-[11.5px] text-text-muted">Earlier</p>
          <ul className="space-y-2">
            {ctx.calls.map((c) => (
              <li key={c.id} className="text-[12.5px]">
                <span className="text-text-muted">{day(c.started_at)} · call{c.outcome ? ` · ${c.outcome.replace(/_/g, " ")}` : ""}</span>
                {c.note && <p className="whitespace-pre-wrap text-text">{c.note}</p>}
                {c.has_recording && <audio controls preload="none" className="mt-1 h-8 w-full max-w-sm" src={`/api/agent/dialer/recording/${c.id}`} />}
              </li>
            ))}
            {ctx.activity.filter((a) => a.channel !== "call" || !ctx.calls.length).slice(0, 3).map((a, i) => (
              <li key={i} className="text-[12.5px]">
                <span className="text-text-muted">{day(a.occurred_at)} · {a.channel} · {a.outcome.replace(/_/g, " ")}</span>
                <p className="line-clamp-3 whitespace-pre-wrap text-text">{a.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function DialerWorkspace() {
  const d = useDialer();
  const [phone, setPhone] = useState("");
  const [pick, setPick] = useState<Pick | null>(null);
  const [leads, setLeads] = useState<OutreachTarget[] | null>(null);
  const [q, setQ] = useState("");
  const [ctx, setCtx] = useState<Context | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);

  const c = d?.current || null;
  const active = Boolean(c && ACTIVE.includes(c.status));
  useTick(active);

  useEffect(() => {
    fetch("/api/team/leads", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => setLeads(j?.targets || [])).catch(() => setLeads([]));
  }, []);

  // Who the left side is about: the call on the line, else the lead picked.
  const subject: Pick | null = c && (active || !pick) ? { id: c.target_id || undefined, phone: c.phone, name: c.target_name || c.phone } : pick;
  const subjectKey = subject ? subject.id || subject.phone : "";
  useEffect(() => {
    if (!subject) { setCtx(null); return; }
    let off = false;
    setCtx(null); setCtxLoading(true);
    const qs = subject.id ? `target_id=${subject.id}` : `phone=${encodeURIComponent(subject.phone)}`;
    fetch(`/api/team/dialer/context?${qs}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!off) { setCtx(j); setCtxLoading(false); } }).catch(() => { if (!off) setCtxLoading(false); });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectKey, c?.processed_at]);

  const myId = d?.state?.me?.id;
  const list = useMemo(() => {
    const words = q.trim().toLowerCase();
    const digits = words.replace(/\D/g, "");
    return (leads || [])
      .filter((t) => t.phone && tail(t.phone).length === 10 && !["won", "lost"].includes(t.status))
      .filter((t) => !words || [t.name, t.org, t.city].some((v) => v?.toLowerCase().includes(words)) || (digits.length >= 3 && tail(t.phone).includes(digits)))
      .sort((a, b) => Number(b.owner_id === myId) - Number(a.owner_id === myId) || (b.inbound?.came_in_at || b.created_at).localeCompare(a.inbound?.came_in_at || a.created_at))
      .slice(0, 40);
  }, [leads, q, myId]);

  if (!d?.state) return <div className="flex h-screen items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={20} /></div>;
  const s = d.state;
  const me = s.me;
  const busy = Boolean(d.starting) || active;
  const digits = phone.replace(/\D/g, "");
  const who = d.starting || c?.target_name || c?.phone || "";
  const connected = c?.status === "connected";
  const status = connected ? `On call · ${clock(c!.answered_at || c!.started_at)}`
    : busy ? (d.starting || !s.live ? "Your phone is ringing. Pick up." : "PROXe dialing now…")
    : c && !c.processed_at ? "Saving the recording and note…"
    : s.live ? "Line open. Call the next one." : "Ready";
  const call = (p: Pick) => { setPick(p); d.dial(p.id ? { id: p.id, name: p.name } : { phone: p.phone, name: p.name }); };
  const key = "flex h-14 items-center justify-center rounded-soft border border-[var(--border)] text-[20px] font-semibold text-text hover:bg-[var(--surface-hover)] active:bg-[var(--surface-hover)]";

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login?next=/dialer";
  }

  const dialer = (
    <aside className={`${card} flex flex-col gap-3 p-4 lg:sticky lg:top-[72px]`}>
      <div className="flex min-h-[92px] flex-col items-center justify-center gap-1 rounded-soft bg-[var(--bg)] px-3 py-3 text-center">
        {busy || (c && !c.processed_at) ? <p className="max-w-full truncate text-[18px] font-bold text-text">{who}</p> : null}
        <p aria-live="polite" className={`text-[14px] ${connected ? "font-semibold text-accent-green" : busy ? "text-text" : "text-text-muted"}`}>{status}</p>
        {connected && <p className="flex items-center gap-1.5 text-[11.5px] text-accent-red"><span className="h-2 w-2 animate-pulse rounded-full bg-accent-red" /> Recording</p>}
        {busy && !connected && <p className="text-[11.5px] text-text-muted">Stay on the call.</p>}
      </div>

      {busy ? (
        <button onClick={d.end} disabled={!c} className="flex h-14 items-center justify-center gap-2 rounded-pill bg-accent-red text-[16px] font-semibold text-white disabled:opacity-50">
          <PhoneOff size={18} /> End call
        </button>
      ) : (
        <>
          <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, "").slice(0, 16))} placeholder="Enter a number" inputMode="tel" aria-label="Number to call"
            className="h-14 w-full rounded-soft border border-[var(--border)] bg-[var(--bg)] px-3 text-center text-[24px] font-semibold tracking-wide text-text outline-none placeholder:text-[15px] placeholder:font-normal placeholder:text-text-muted focus:border-[var(--brand-line)]" />
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "0"].map((k) => (
              <button key={k} type="button" className={key} onClick={() => setPhone((p) => (p + k).slice(0, 16))}>{k}</button>
            ))}
            <button type="button" className={key} onClick={() => setPhone((p) => p.slice(0, -1))} aria-label="Delete last digit"><Delete size={20} /></button>
          </div>
          <button onClick={() => call({ phone, name: phone })} disabled={digits.length < 10 || !d.ready}
            className="flex h-14 items-center justify-center gap-2 rounded-pill bg-accent-green text-[16px] font-semibold text-white disabled:opacity-40">
            <Phone size={18} /> Call
          </button>
        </>
      )}
      {d.message && <p className="text-center text-[12.5px] text-accent-red">{d.message}</p>}
      {!me?.number ? <p className="text-center text-[12px] text-text-muted">No company number is set for you yet. Ask the owner.</p>
        : !me.mobile ? <p className="text-center text-[12px] text-text-muted">First <Link href="/team/dialer" className="underline">save your mobile</Link>, so the dialer can ring you.</p>
        : <p className="text-center text-[11.5px] text-text-muted">Your phone rings first. They see {me.number}. Every call is recorded.</p>}
      {!busy && s.live && <button onClick={d.closeLine} className="h-9 rounded-pill border border-[var(--border)] text-[12.5px] text-text-muted">Close my line</button>}
    </aside>
  );

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4">
          <span className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-text"><span className="h-2.5 w-2.5 rounded-full bg-[var(--brand)]" /> PROXe Dialer</span>
          <nav className="ml-auto flex items-center gap-1 text-[12.5px]">
            <Link href="/team/dialer" className="rounded-soft px-3 py-2 text-text-muted hover:bg-[var(--surface-hover)] hover:text-text">Call logs</Link>
            <Link href="/team/leads" className="hidden rounded-soft px-3 py-2 text-text-muted hover:bg-[var(--surface-hover)] hover:text-text sm:block">Leads</Link>
            <ThemeToggle />
            <button onClick={logout} aria-label="Log out" className="flex h-9 items-center gap-1.5 rounded-soft px-2 text-text-muted hover:bg-[var(--surface-hover)] hover:text-text"><LogOut size={15} /></button>
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1200px] gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
          {subject && <Known pick={subject} ctx={ctx} loading={ctxLoading} />}

          {subject && (s.guide?.length ?? 0) > 0 && (active || !c?.checklist || c.target_id !== subject.id) && (
            <section className={`${card} p-4`}>
              <h2 className="mb-2 text-[14px] font-semibold text-text">Ask on this call</h2>
              <Guide questions={s.guide || []} callId={c && active ? c.id : subjectKey} bare />
            </section>
          )}

          {c && !active && c.processed_at && subject && (c.target_id ? c.target_id === subject.id : c.phone === subject.phone) && (
            <section className={`${card} p-4`}>
              <h2 className="text-[14px] font-semibold text-text">Last call: {c.status === "no_answer" ? "no answer" : c.status === "failed" ? "did not go through" : "saved"}</h2>
              {c.note && <p className="mt-1 whitespace-pre-wrap text-[13px] text-text">{c.note}</p>}
              {c.has_recording && <audio controls preload="none" className="mt-2 h-9 w-full max-w-md" src={`/api/agent/dialer/recording/${c.id}`} />}
              {c.checklist && c.checklist.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[12.5px]">
                  {c.checklist.map((x, i) => (
                    <li key={i} className="flex gap-2">
                      <span className={`w-16 shrink-0 font-semibold ${x.answered ? "text-accent-green" : "text-accent-red"}`}>{x.answered ? "Answered" : "Not asked"}</span>
                      <span className="text-text">{x.q}{x.answered && x.answer ? <span className="text-text-muted">: {x.answer}</span> : null}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {!busy && (
            <section className={`${card} overflow-hidden`}>
              <label className="relative block border-b border-[var(--border)]">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a lead: name, company, city or number" aria-label="Find a lead"
                  className="h-11 w-full bg-transparent pl-9 pr-3 text-[13.5px] text-text outline-none placeholder:text-text-muted" />
              </label>
              {!leads ? (
                <div className="flex h-24 items-center justify-center text-text-muted"><Loader2 className="animate-spin" size={16} /></div>
              ) : (
                <ul>
                  {list.map((t) => (
                    <li key={t.id} className={`flex items-center gap-3 border-t border-[var(--border)] px-3 py-2 first:border-t-0 ${pick?.id === t.id ? "bg-[var(--surface-hover)]" : ""}`}>
                      <button onClick={() => setPick({ id: t.id, phone: t.phone!, name: t.name })} className="flex min-w-0 flex-1 flex-col items-start text-left">
                        <span className="w-full truncate text-[13.5px] font-medium text-text">{t.name}</span>
                        <span className="w-full truncate text-[11.5px] text-text-muted">{[t.org, t.city, t.source === "proxe_inbound" ? "Inbound" : null].filter(Boolean).join(" · ") || t.phone}</span>
                      </button>
                      <button onClick={() => call({ id: t.id, phone: t.phone!, name: t.name })} disabled={!d.ready} aria-label={`Call ${t.name}`}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-green text-white disabled:opacity-40">
                        <Phone size={16} />
                      </button>
                    </li>
                  ))}
                  {!list.length && <li className="px-3 py-8 text-center text-[13px] text-text-muted">No lead matches. Type the number on the keypad instead.</li>}
                </ul>
              )}
            </section>
          )}
        </div>
        <div className="order-1 lg:order-2">{dialer}</div>
      </div>
    </div>
  );
}
