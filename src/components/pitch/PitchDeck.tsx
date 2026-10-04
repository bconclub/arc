"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, X, MessageCircle, Phone, Globe, Camera, Send, Check, Clock,
} from "lucide-react";

// ── live numbers, from the same overview the investor portal reads ──
type Live = {
  goal: { leads: number; demos: number; conversions: number; targets: { leads: number; demos: number; conversions: number } };
  sales: { total: number } | null;
  stake: {
    valuation: number | null;
    roundInfo: { name: string; target: number; equityOffered: number; closesOn: string; raised: number; daysLeft: number } | null;
  };
};

const INK = "#0b0c08";
const LIME = "#cbfa0a";
const GOLD = "#e8b931";

const inr = (n: number) =>
  n >= 1e7 ? `₹${+(n / 1e7).toFixed(2)}Cr` : n >= 1e5 ? `₹${+(n / 1e5).toFixed(2)}L` : `₹${n.toLocaleString("en-IN")}`;

type Slide = { key: string; tone: "lime" | "ink"; label: string; render: (live: Live | null) => React.ReactNode };

/** Small, quiet pill used inside cards. */
function Pill({ children, on = false }: { children: React.ReactNode; on?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] ${on ? "bg-[#cbfa0a] text-[#0b0c08]" : "bg-white/[0.07] text-white/80"}`}>
      {children}
    </span>
  );
}

function Headline({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <h2 className={`text-balance text-[30px] font-semibold leading-[1.05] tracking-[-0.025em] sm:text-[36px] ${dark ? "text-[#0b0c08]" : "text-white"}`}>
      {children}
    </h2>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[15px] leading-relaxed text-white/65">{children}</p>;
}

function Progress({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-white/70">{label}</span>
        <span className="tabular-nums text-white/50">
          <span className="text-[17px] font-semibold text-white">{value.toLocaleString("en-IN")}</span> / {target.toLocaleString("en-IN")}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, (value / target) * 100))}%`, background: color }} />
      </div>
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    key: "cover", tone: "lime", label: "PROXe",
    render: () => (
      <div className="flex h-full flex-col justify-between">
        <p className="text-[13px] font-semibold tracking-[0.02em] text-[#0b0c08]/60">AI lead conversion</p>
        <div>
          <p className="text-[64px] font-bold leading-none tracking-[-0.045em] text-[#0b0c08] sm:text-[80px]">PROXe</p>
          <p className="mt-4 text-balance text-[22px] font-medium leading-snug tracking-[-0.015em] text-[#0b0c08]">
            Never miss a lead again.
          </p>
        </div>
        <p className="text-[14.5px] leading-relaxed text-[#0b0c08]/70">
          Turns every potential customer into revenue. Listens across every channel. Never forgets. Always improving.
        </p>
      </div>
    ),
  },
  {
    key: "problem", tone: "ink", label: "The problem",
    render: () => (
      <>
        <Headline>Leads go cold in the inbox.</Headline>
        <Body>Someone asks a question at 9 pm. The reply comes the next morning. By then they have booked whoever answered first.</Body>
        <div className="mt-auto space-y-2 pt-6">
          <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/[0.08] px-3.5 py-2.5 text-[13.5px] text-white">
            Hi, what is the fee for the weekend batch?
            <span className="mt-1 block text-[10.5px] text-white/40">9:02 pm · WhatsApp</span>
          </div>
          <div className="flex items-center gap-1.5 pl-1 text-[11px] text-white/35"><Clock size={11} /> 13 hours of silence</div>
          <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.04] px-3.5 py-2.5 text-right text-[13.5px] text-white/45">
            So sorry for the late reply!
            <span className="mt-1 block text-[10.5px] text-white/30">10:47 am · too late</span>
          </div>
        </div>
      </>
    ),
  },
  {
    key: "gap", tone: "ink", label: "Why it persists",
    render: () => (
      <>
        <Headline>A gap every business has accepted as normal.</Headline>
        <Body>Great products keep losing to faster replies. Nobody tracks it, so nobody fixes it.</Body>
        <ul className="mt-auto space-y-2.5 pt-6">
          {[
            ["Slow first reply", "the lead moves on while the team is busy"],
            ["Forgotten follow-ups", "interest fades after the first message"],
            ["Lost context", "WhatsApp, calls and DMs never meet"],
          ].map(([t, d]) => (
            <li key={t} className="rounded-2xl bg-white/[0.06] px-4 py-3">
              <p className="text-[15px] font-medium text-white">{t}</p>
              <p className="text-[12.5px] text-white/50">{d}</p>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    key: "who", tone: "ink", label: "Who feels it",
    render: () => (
      <>
        <Headline>Businesses that live on enquiries.</Headline>
        <Body>Indian SMBs where the customer starts on WhatsApp, and the founder is the one replying.</Body>
        <div className="mt-auto flex flex-wrap gap-2 pt-6">
          {["Coaching academies", "Clinics", "Real estate", "Tutoring centres", "Wellness & spa", "Solo founders"].map((x, i) => (
            <Pill key={x} on={i === 0}>{x}</Pill>
          ))}
        </div>
      </>
    ),
  },
  {
    key: "solution", tone: "ink", label: "What PROXe does",
    render: () => (
      <>
        <Headline>Answers in seconds. On every channel.</Headline>
        <Body>One AI brain captures every lead, replies, qualifies, books the call, and keeps following up until they are ready to buy.</Body>
        <div className="mt-auto grid grid-cols-5 gap-2 pt-6">
          {[
            [MessageCircle, "WhatsApp"], [Phone, "Voice"], [Globe, "Web chat"], [Camera, "Instagram"], [Send, "Messenger"],
          ].map(([Icon, name]) => {
            const I = Icon as typeof Phone;
            return (
              <div key={name as string} className="flex flex-col items-center gap-1.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#cbfa0a] text-[#0b0c08]"><I size={18} /></span>
                <span className="text-center text-[10.5px] leading-tight text-white/55">{name as string}</span>
              </div>
            );
          })}
        </div>
      </>
    ),
  },
  {
    key: "how", tone: "ink", label: "How it works",
    render: () => (
      <>
        <Headline>Capture. Nurture. Close. Repeat.</Headline>
        <ol className="mt-auto space-y-2 pt-6">
          {[
            ["Capture", "every message, call and DM, logged and scored"],
            ["Nurture", "replies and follow-ups in the business's own tone"],
            ["Close", "books the demo or the visit, reminds, recovers no-shows"],
            ["Repeat", "learns from every conversation"],
          ].map(([t, d], i) => (
            <li key={t} className="flex items-start gap-3 rounded-2xl bg-white/[0.06] px-4 py-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#cbfa0a] text-[12px] font-bold tabular-nums text-[#0b0c08]">{i + 1}</span>
              <span>
                <span className="block text-[15px] font-medium text-white">{t}</span>
                <span className="text-[12.5px] text-white/50">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </>
    ),
  },
  {
    key: "memory", tone: "ink", label: "One memory",
    render: () => (
      <>
        <Headline>The customer never repeats themselves.</Headline>
        <Body>WhatsApp on Monday, a call on Thursday, the pricing page on Saturday. PROXe remembers all of it.</Body>
        <div className="mt-auto pt-6">
          <div className="space-y-2">
            {[
              ["Mon", "WhatsApp", "asked about pricing"],
              ["Thu", "Call", "asked for a demo"],
              ["Sat", "Website", "came back to pricing"],
            ].map(([d, c, t]) => (
              <div key={d} className="flex items-center gap-3 text-[13.5px]">
                <span className="w-9 shrink-0 tabular-nums text-white/40">{d}</span>
                <span className="rounded-full bg-white/[0.07] px-2.5 py-0.5 text-[11.5px] text-white/70">{c}</span>
                <span className="text-white/80">{t}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#cbfa0a] px-4 py-3 text-[#0b0c08]">
            <span className="text-[13px] font-medium">Lead score · high intent</span>
            <span className="text-[26px] font-bold tabular-nums tracking-tight">92</span>
          </div>
          <p className="mt-2 text-[10.5px] text-white/30">Illustration</p>
        </div>
      </>
    ),
  },
  {
    key: "price", tone: "ink", label: "Business model",
    render: () => (
      <>
        <Headline>One plan. One price.</Headline>
        <Body>A monthly subscription. The cost of one missed customer, for a system that never misses one.</Body>
        <div className="mt-auto pt-6">
          <p className="text-[56px] font-bold leading-none tracking-[-0.04em] text-white tabular-nums">₹9,999</p>
          <p className="mt-1 text-[14px] text-white/50">per month, per business</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Pill>Every channel</Pill><Pill>Founder dashboard</Pill><Pill>Trained on your playbook</Pill>
          </div>
        </div>
      </>
    ),
  },
  {
    key: "traction", tone: "ink", label: "Traction",
    render: (live) => (
      <>
        <Headline>Where we are, live.</Headline>
        <Body>Pulled from ARC right now, against the plan this round funds.</Body>
        <div className="mt-auto space-y-4 pt-6">
          {live ? (
            <>
              <Progress label="Leads reached" value={live.goal.leads} target={live.goal.targets.leads} color="#60a5fa" />
              <Progress label="Demos done" value={live.goal.demos} target={live.goal.targets.demos} color={LIME} />
              <Progress label="Paying customers" value={live.goal.conversions} target={live.goal.targets.conversions} color="#22c55e" />
              {live.sales && <p className="text-[12.5px] text-white/50">{inr(live.sales.total)} collected through checkout</p>}
            </>
          ) : (
            <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-9 animate-pulse rounded-xl bg-white/[0.06]" />)}</div>
          )}
        </div>
      </>
    ),
  },
  {
    key: "round", tone: "ink", label: "The round",
    render: (live) => {
      const r = live?.stake.roundInfo;
      return (
        <>
          <Headline>{r ? `${r.name}: ${r.equityOffered}% for ${inr(r.target)}` : "Pre-seed"}</Headline>
          <Body>Raised against one plan: 5,000 leads, 1,000 demos, 100 paying customers.</Body>
          <div className="mt-auto space-y-3 pt-6">
            {[
              ["Valuation (post-money)", live?.stake.valuation ? inr(live.stake.valuation) : "–"],
              ["Raised so far", r ? `${inr(r.raised)} of ${inr(r.target)}` : "–"],
              ["Round closes", r ? `${new Date(r.closesOn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · ${r.daysLeft} days` : "–"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 rounded-2xl bg-white/[0.06] px-4 py-3">
                <span className="text-[13px] text-white/55">{k}</span>
                <span className="text-[15px] font-semibold tabular-nums text-white">{v}</span>
              </div>
            ))}
            {r && (
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.raised / r.target) * 100)}%`, background: GOLD }} />
              </div>
            )}
          </div>
        </>
      );
    },
  },
  {
    key: "founder", tone: "ink", label: "Who is building it",
    render: () => (
      <>
        <Headline>Built by a marketer who lost leads too.</Headline>
        <Body>
          Thanzeel Ashruf (Z). Seven years in marketing across retail, services, hospitality, real estate and healthcare. Also runs BCON Club, teaching businesses to build with AI.
        </Body>
        <div className="mt-auto flex items-center gap-3 pt-6">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#cbfa0a] text-[20px] font-bold text-[#0b0c08]">Z</span>
          <span>
            <span className="block text-[15px] font-medium text-white">Thanzeel Ashruf</span>
            <span className="text-[12.5px] text-white/50">Founder, PROXe · BCON Club</span>
          </span>
        </div>
      </>
    ),
  },
  {
    key: "close", tone: "lime", label: "Try it",
    render: () => (
      <div className="flex h-full flex-col justify-between">
        <p className="text-[13px] font-semibold text-[#0b0c08]/60">Hear it for yourself</p>
        <div>
          <Headline dark>PROXe calls you in five seconds.</Headline>
          <p className="mt-3 text-[15px] leading-relaxed text-[#0b0c08]/70">Free, no signup. Put in a number on goproxe.com and pick up.</p>
        </div>
        <a href="https://goproxe.com" target="_blank" rel="noreferrer"
          className="flex items-center justify-between rounded-2xl bg-[#0b0c08] px-5 py-4 text-[15px] font-medium text-white">
          goproxe.com <ArrowRight size={18} />
        </a>
      </div>
    ),
  },
];

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

export function PitchDeck() {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [card, setCard] = useState({ w: 380, step: 300 });
  const [reduced, setReduced] = useState(false);
  const [live, setLive] = useState<Live | null>(null);
  const start = useRef<{ x: number; y: number; t: number; locked: "x" | "y" | null } | null>(null);
  const wheelLock = useRef(0);
  // A drag that ends over a side card must not also count as a tap on it.
  const moved = useRef(false);
  const n = SLIDES.length;

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(n - 1, i))), [n]);

  // Card size follows the screen; the step is how far neighbours sit.
  useLayoutEffect(() => {
    const fit = () => {
      const vw = window.innerWidth;
      const w = Math.min(vw * 0.86, 420);
      setCard({ w, step: vw < 640 ? w * 0.94 : w * 0.66 });
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); setIndex((i) => Math.min(n - 1, i + 1)); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
      if (e.key === "Home") setIndex(0);
      if (e.key === "End") setIndex(n - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [n]);

  // Live numbers arrive after the deck is already moving.
  useEffect(() => {
    fetch("/api/investor/overview?days=3650").then((r) => (r.ok ? r.json() : null)).then((j) => j && setLive(j)).catch(() => {});
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY, t: performance.now(), locked: null };
    moved.current = false;
  }
  function onPointerMove(e: React.PointerEvent) {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.locked && Math.abs(dx) + Math.abs(dy) > 6) {
      s.locked = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (s.locked === "x") { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDragging(true); moved.current = true; }
    }
    if (s.locked === "x") {
      // Resist past the ends.
      const edge = (index === 0 && dx > 0) || (index === n - 1 && dx < 0);
      setDrag(edge ? dx * 0.3 : dx);
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    const s = start.current;
    start.current = null;
    if (!s || s.locked !== "x") { setDragging(false); setDrag(0); return; }
    const dx = e.clientX - s.x;
    const v = dx / Math.max(1, performance.now() - s.t); // px per ms
    let move = -Math.round(dx / card.step);
    if (move === 0 && Math.abs(v) > 0.35) move = v < 0 ? 1 : -1;
    setDragging(false);
    setDrag(0);
    go(index + move);
  }
  function onWheel(e: React.WheelEvent) {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const now = performance.now();
    if (Math.abs(d) < 12 || now - wheelLock.current < 420) return;
    wheelLock.current = now;
    go(index + (d > 0 ? 1 : -1));
  }

  const pos = index - drag / card.step;

  return (
    <div className="fixed inset-0 flex select-none flex-col overflow-hidden" style={{ background: "#0e0f0b", color: "white" }}>
      <header className="flex items-center justify-between px-5 pt-[max(16px,env(safe-area-inset-top))] sm:px-8">
        <span className="text-[15px] font-bold tracking-[-0.02em]">PROXe <span className="font-normal text-white/40">· pitch</span></span>
        <Link href="/dashboard" aria-label="Close the pitch" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.07] text-white/70 transition-colors hover:text-white">
          <X size={17} />
        </Link>
      </header>

      {/* The stage */}
      <div
        className="relative flex-1 touch-pan-y"
        style={{ perspective: "1400px" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        role="region"
        aria-roledescription="carousel"
        aria-label="PROXe pitch"
      >
        {SLIDES.map((s, i) => {
          const d = i - pos;
          const a = Math.abs(d);
          if (a > 3.2) return null;
          const sign = Math.sign(d);
          const x = sign * (a <= 1 ? a * card.step : card.step + (a - 1) * card.step * 0.42);
          const rot = reduced ? 0 : -sign * Math.min(a, 1) * 38;
          const z = reduced ? 0 : -Math.min(a, 3) * 150;
          const scale = 1 - Math.min(a, 3) * (reduced ? 0.06 : 0.03);
          const current = i === index;
          const lime = s.tone === "lime";
          return (
            <article
              key={s.key}
              aria-hidden={!current}
              aria-label={`${i + 1} of ${n}: ${s.label}`}
              onClick={() => { if (!current && !moved.current) go(i); }}
              className="absolute left-1/2 top-1/2 flex flex-col overflow-hidden rounded-[28px] p-6 sm:p-7"
              style={{
                width: card.w,
                height: `min(68dvh, 600px)`,
                marginLeft: -card.w / 2,
                transform: `translate3d(${x}px, -50%, ${z}px) rotateY(${rot}deg) scale(${scale})`,
                transition: dragging ? "none" : `transform 620ms ${EASE}`,
                zIndex: 100 - Math.round(a * 10),
                background: lime ? LIME : "#181a14",
                boxShadow: "0 30px 60px -20px rgba(0,0,0,0.65)",
                willChange: "transform",
                cursor: current ? "grab" : "pointer",
              }}
            >
              {!lime && <p className="mb-4 text-[12px] font-medium text-[#cbfa0a]">{s.label}</p>}
              <div className="flex min-h-0 flex-1 flex-col">{s.render(live)}</div>
              {/* Cards off to the side sink into the dark */}
              <div
                className="pointer-events-none absolute inset-0 rounded-[28px]"
                style={{ background: INK, opacity: Math.min(a, 1.6) * 0.42, transition: dragging ? "none" : `opacity 620ms ${EASE}` }}
              />
            </article>
          );
        })}
      </div>

      {/* Where you are, and the way forward */}
      <footer className="flex items-center justify-between gap-4 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 sm:px-8">
        <button onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous card"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-white transition-opacity disabled:opacity-25">
          <ArrowLeft size={18} />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
          {SLIDES.map((s, i) => (
            <button key={s.key} onClick={() => go(i)} aria-label={`Go to ${s.label}`}
              className="flex h-11 items-center" style={{ width: i === index ? 26 : 10 }}>
              <span className="block h-1.5 w-full rounded-full transition-all duration-300"
                style={{ background: i === index ? LIME : "rgba(255,255,255,0.18)" }} />
            </button>
          ))}
        </div>
        <button onClick={() => go(index + 1)} disabled={index === n - 1} aria-label="Next card"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#cbfa0a] text-[#0b0c08] transition-opacity disabled:opacity-25">
          {index === n - 1 ? <Check size={18} /> : <ArrowRight size={18} />}
        </button>
      </footer>
    </div>
  );
}
