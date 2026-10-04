"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, X, Phone, Globe, Clock, Pause, Play, Radar, BellOff, CalendarX, Unlink, MessagesSquare, CalendarCheck, Repeat2, Check, Volume2, VolumeX,
} from "lucide-react";
import * as B from "./brandIcons";
import { TalkToProxe } from "./TalkToProxe";

// ── PROXe's own palette, from goproxe.com ──
const C = {
  page: "#0d0a1c",
  card: "#16112b",
  line: "rgba(167,139,250,0.22)",
  violet: "#a78bfa",
  deep: "#7c3aed",
  money: "#e8b931",
  good: "#22c55e",
  leak: "#f87171",
};
const GRAINIENT = "linear-gradient(135deg,#7C3AED 0%,#4C1D95 50%,#1E1B4B 100%)";
// The site's grain, as a tiny SVG noise tile instead of its WebGL shader.
const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>")`;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const LINKEDIN = "https://www.linkedin.com/in/thanzeelashruf/";

type Live = {
  goal: { leads: number; demos: number; conversions: number; targets: { leads: number; demos: number; conversions: number } };
  sales: { total: number } | null;
  stake: {
    valuation: number | null;
    roundInfo: { name: string; target: number; equityOffered: number; closesOn: string; raised: number; daysOpen: number; daysLeft: number } | null;
  };
};

const inr = (n: number) =>
  n >= 1e7 ? `₹${+(n / 1e7).toFixed(2)}Cr` : n >= 1e5 ? `₹${+(n / 1e5).toFixed(2)}L` : `₹${n.toLocaleString("en-IN")}`;

// ── small parts ──

function Brand({ d, color, size = 18 }: { d: string; color: string; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden><path d={d} fill={color} /></svg>;
}

/** Each child rises in, one after another, when its card comes to the front. */
function Stagger({ on, children, className = "", step = 90 }: { on: boolean; children: React.ReactNode[]; className?: string; step?: number }) {
  return (
    <div className={className}>
      {children.map((c, i) => (
        <div key={i} className={on ? "pitch-in" : "opacity-0"} style={{ animationDelay: `${120 + i * step}ms` }}>{c}</div>
      ))}
    </div>
  );
}

function Headline({ children }: { children: React.ReactNode }) {
  return <h2 className="text-balance text-[27px] font-semibold leading-[1.06] tracking-[-0.025em] text-white sm:text-[33px]">{children}</h2>;
}
function Body({ children }: { children: React.ReactNode }) {
  return <p className="mt-2.5 text-[14.5px] leading-relaxed text-white/65">{children}</p>;
}

/** Concentric rings, one per goal, drawn when the card is in front. */
function Rings({ on, rows }: { on: boolean; rows: { value: number; target: number; color: string }[] }) {
  const R = [64, 50, 36];
  return (
    <svg viewBox="0 0 160 160" className="h-36 w-36 shrink-0 -rotate-90" aria-hidden>
      {rows.map((r, i) => {
        const len = 2 * Math.PI * R[i]!;
        const frac = Math.max(0.025, Math.min(1, r.value / r.target));
        return (
          <g key={i}>
            <circle cx="80" cy="80" r={R[i]} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
            <circle cx="80" cy="80" r={R[i]} fill="none" stroke={r.color} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={len} strokeDashoffset={on ? len * (1 - frac) : len}
              style={{ transition: `stroke-dashoffset 1400ms ${EASE} ${300 + i * 150}ms` }} />
          </g>
        );
      })}
    </svg>
  );
}

/** Each gap as it happens to a business, then what PROXe does about it. */
function GapFix({ on }: { on: boolean }) {
  const rows = [
    { icon: Clock, gap: "Slow first reply", what: "the lead waits, then moves on", fix: "replies in seconds" },
    { icon: BellOff, gap: "No follow-up", what: "interested once, never messaged again", fix: "follows up for days" },
    { icon: CalendarX, gap: "No-shows", what: "demo booked, nobody reminded them", fix: "reminds and rebooks" },
    { icon: Unlink, gap: "Lost context", what: "WhatsApp, then a call, and they start over", fix: "remembers everything" },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r, i) => {
        const Icon = r.icon;
        return (
          <div key={r.gap} className={`overflow-hidden rounded-2xl bg-white/[0.04] ${on ? "pitch-in" : "opacity-0"}`} style={{ animationDelay: `${120 + i * 140}ms` }}>
            <div className="flex items-center gap-3 px-3.5 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(248,113,113,0.14)", color: C.leak }}><Icon size={15} /></span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium text-white">{r.gap}</span>
                <span className="block text-[11.5px] leading-snug text-white/50">{r.what}</span>
              </span>
            </div>
            {/* PROXe's answer slides in under each gap */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 text-[11.5px] font-medium"
              style={{
                background: "rgba(124,58,237,0.22)", color: "#ddd6fe",
                transform: on ? "none" : "translateX(-100%)", transition: `transform 600ms ${EASE} ${900 + i * 260}ms`,
              }}>
              <Check size={12} /> PROXe {r.fix}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── the cards ──

type Slide = { key: string; hero?: boolean; label: string; render: (p: { on: boolean; live: Live | null; setOrb: (b: boolean) => void; started: boolean; start: () => void }) => React.ReactNode };

const SLIDES: Slide[] = [
  {
    key: "cover", hero: true, label: "The pitch",
    render: ({ on, started, start }) => (
      <div className="flex h-full flex-col">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/proxe-logo-white.webp" alt="PROXe" className={`h-9 w-auto self-start ${on ? "pitch-in" : ""}`} />
        <div className="flex flex-1 flex-col justify-center">
          <h1 className={`text-balance text-[34px] font-semibold leading-[1.04] tracking-[-0.03em] text-white sm:text-[40px] ${on ? "pitch-in" : "opacity-0"}`} style={{ animationDelay: "150ms" }}>
            Your AI for the customer side of your business.
          </h1>
          <p className={`mt-4 text-[16px] text-white/75 ${on ? "pitch-in" : "opacity-0"}`} style={{ animationDelay: "300ms" }}>
            Never miss a lead ever again.
          </p>
        </div>
        {!started ? (
          <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); start(); }}
            className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-left text-[#3b1a8a] transition-transform active:scale-[0.98]">
            <span>
              <span className="block text-[16px] font-semibold">Play the pitch</span>
              <span className="text-[12px] text-[#3b1a8a]/70">About 3 minutes · narrated</span>
            </span>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#7c3aed] text-white"><Play size={18} className="translate-x-[1px]" /></span>
          </button>
        ) : (
          <Stagger on={on} className="flex items-center gap-2.5" step={70}>
          {[
            <span key="w" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12"><Brand d={B.whatsapp} color="#fff" /></span>,
            <span key="i" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12"><Brand d={B.instagram} color="#fff" /></span>,
            <span key="m" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12"><Brand d={B.messenger} color="#fff" /></span>,
            <span key="p" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white"><Phone size={17} /></span>,
            <span key="g" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white"><Globe size={17} /></span>,
          ]}
          </Stagger>
        )}
      </div>
    ),
  },
  {
    key: "problem", label: "The problem",
    render: ({ on }) => (
      <>
        <Headline>Brands pay for leads. Then nobody responds.</Headline>
        <Body>Money goes into making ads and running them. The leads show up, and they go unanswered.</Body>
        <div className="flex flex-1 flex-col justify-center pt-4">
          <Stagger on={on} step={260} className="space-y-0">
            {[
              <Step key="a" icon={<Brand d={B.meta} color="#fff" size={16} />} tint={C.deep} title="Make the ads" sub="creative, shoots, edits" />,
              <Joint key="j1" on={on} delay={420} />,
              <Step key="b" icon={<Brand d={B.meta} color="#fff" size={16} />} tint={C.deep} title="Run the ads" sub="budget spent every day" />,
              <Joint key="j2" on={on} delay={940} />,
              <Step key="c" icon={<Brand d={B.whatsapp} color="#25D366" size={17} />} tint="rgba(37,211,102,0.16)" title="Leads show up" sub="on WhatsApp, Instagram, calls" />,
              <Joint key="j3" on={on} delay={1460} leak />,
              <Step key="d" icon={<X size={16} className="text-[#f87171]" />} tint="rgba(248,113,113,0.14)" title="Nobody responds" sub="the lead and the ad money, gone" />,
            ]}
          </Stagger>
        </div>
      </>
    ),
  },
  {
    key: "gaps", label: "Where it leaks",
    render: ({ on }) => (
      <>
        <Headline>Four gaps every business has stopped noticing.</Headline>
        <div className="flex flex-1 flex-col justify-center pt-4">
          <GapFix on={on} />
        </div>
      </>
    ),
  },
  {
    key: "who", label: "Who feels it",
    render: ({ on }) => (
      <>
        <Headline>Any business that runs on leads.</Headline>
        <Body>And wants to take better care of its customers. A few we see every day:</Body>
        <div className="flex flex-1 items-center pt-4">
          <Stagger on={on} className="grid w-full grid-cols-2 gap-2" step={80}>
            {[
              ["coaching", "Coaching academies"], ["clinics", "Clinics"], ["real-estate", "Real estate"],
              ["academies", "Training academies"], ["wellness", "Wellness & spa"], ["services", "Professional services"],
            ].map(([img, t]) => (
              <div key={t} className="relative h-[84px] overflow-hidden rounded-2xl sm:h-[96px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/pitch/${img}.webp`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(22,17,43,0.05) 30%, rgba(22,17,43,0.92) 100%)" }} />
                <span className="absolute bottom-2 left-2.5 right-2 text-[12.5px] font-medium leading-tight text-white">{t}</span>
              </div>
            ))}
          </Stagger>
        </div>
      </>
    ),
  },
  {
    key: "solution", label: "What PROXe does",
    render: ({ on }) => (
      <>
        <Headline>Answers in seconds. On every channel.</Headline>
        <Body>One AI brain replies, qualifies, books the call, and keeps following up until they are ready to buy.</Body>
        <div className="flex flex-1 items-center justify-center pt-2">
          <Hub on={on} />
        </div>
      </>
    ),
  },
  {
    key: "how", label: "How it works",
    render: ({ on }) => (
      <>
        <Headline>Capture. Nurture. Close. Repeat.</Headline>
        <div className="flex flex-1 flex-col justify-center pt-4">
          <Stagger on={on} className="space-y-2" step={140}>
            {[
              [Radar, "Capture", "every message, call and DM, logged and scored"],
              [MessagesSquare, "Nurture", "replies and follow-ups in the business's own tone"],
              [CalendarCheck, "Close", "books the demo or visit, reminds, recovers no-shows"],
              [Repeat2, "Repeat", "learns from every conversation"],
            ].map(([I, t, d]) => {
              const Icon = I as typeof Phone;
              return (
                <div key={t as string} className="flex items-center gap-3 rounded-2xl bg-white/[0.05] px-3.5 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: C.deep }}><Icon size={17} /></span>
                  <span>
                    <span className="block text-[14.5px] font-medium text-white">{t as string}</span>
                    <span className="text-[12px] text-white/50">{d as string}</span>
                  </span>
                </div>
              );
            })}
          </Stagger>
        </div>
      </>
    ),
  },
  {
    key: "dashboard", label: "The founder's view",
    render: ({ on }) => (
      <>
        <Headline>Every lead, scored, with the next step.</Headline>
        <Body>The PROXe dashboard a client runs on today: conversations, high-intent leads, booked calls and where they came from.</Body>
        <div className="flex flex-1 flex-col justify-center pt-4">
          <div className="overflow-hidden rounded-2xl" style={{ boxShadow: `0 0 0 1px ${C.line}, 0 20px 40px -16px rgba(0,0,0,0.8)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pitch/dashboard.webp" alt="PROXe dashboard" loading="lazy" className="block w-full"
              style={{ transform: on ? "scale(1)" : "scale(1.08)", transition: `transform 1600ms ${EASE}` }} />
          </div>
          <Stagger on={on} className="mt-3 flex flex-wrap gap-1.5" step={120}>
            {["Lead score on every lead", "What to do next", "Where leads come from"].map((x) => (
              <span key={x} className="flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1 text-[11.5px] text-white/80">
                <Check size={12} style={{ color: C.violet }} />{x}
              </span>
            ))}
          </Stagger>
        </div>
      </>
    ),
  },
  {
    key: "memory", label: "One memory",
    render: ({ on }) => (
      <>
        <Headline>The customer never repeats themselves.</Headline>
        <Body>WhatsApp on Monday, a call on Thursday, the pricing page on Saturday. PROXe remembers all of it.</Body>
        <div className="flex flex-1 flex-col justify-center pt-4">
          <Stagger on={on} className="space-y-2.5" step={180}>
            {[
              ["Mon", <Brand key="w" d={B.whatsapp} color="#25D366" size={14} />, "asked about pricing"],
              ["Thu", <Phone key="p" size={14} className="text-white/80" />, "asked for a demo"],
              ["Sat", <Globe key="g" size={14} className="text-white/80" />, "came back to pricing"],
            ].map(([d, icon, t]) => (
              <div key={d as string} className="flex items-center gap-3 text-[13.5px]">
                <span className="w-8 shrink-0 tabular-nums text-white/40">{d as string}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07]">{icon as React.ReactNode}</span>
                <span className="text-white/85">{t as string}</span>
              </div>
            ))}
          </Stagger>
          <div className="mt-4 rounded-2xl p-3.5" style={{ background: "rgba(124,58,237,0.22)" }}>
            <div className="flex items-baseline justify-between text-white">
              <span className="text-[13px] font-medium">Lead score · high intent</span>
              <span className="text-[24px] font-bold tabular-nums">92</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full" style={{ background: C.violet, width: on ? "92%" : "0%", transition: `width 1200ms ${EASE} 700ms` }} />
            </div>
          </div>
          <p className="mt-1.5 text-[10.5px] text-white/30">Illustration</p>
        </div>
      </>
    ),
  },
  {
    key: "price", label: "Business model",
    render: ({ on }) => (
      <>
        <Headline>One plan. One price.</Headline>
        <Body>1,000 managed leads a month. That is under ₹10 a lead, when businesses already spend ₹10 to ₹100 on every lead.</Body>
        <div className="flex flex-1 flex-col justify-center pt-4">
          <p className={`text-[56px] font-bold leading-none tracking-[-0.04em] text-white tabular-nums ${on ? "pitch-in" : "opacity-0"}`} style={{ animationDelay: "150ms" }}>₹9,999</p>
          <p className="mt-1 text-[14px] text-white/50">per month · 1,000 managed leads · every channel included</p>
          <Stagger on={on} className="mt-5 grid grid-cols-4 gap-2" step={60}>
            {[
              [<Brand key="w" d={B.whatsapp} color="#25D366" size={20} />, "WhatsApp"],
              [<Brand key="i" d={B.instagram} color="#E4405F" size={19} />, "Instagram"],
              [<Brand key="m" d={B.messenger} color="#0099FF" size={19} />, "Messenger"],
              [<Brand key="f" d={B.facebook} color="#1877F2" size={19} />, "Facebook"],
              [<Phone key="p" size={18} className="text-white" />, "Voice"],
              [<Globe key="g" size={18} className="text-white" />, "Web chat"],
              [<Brand key="e" d={B.gmail} color="#EA4335" size={18} />, "Email"],
              [<MessagesSquare key="s" size={18} className="text-white" />, "SMS"],
            ].map(([icon, label]) => (
              <div key={label as string} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/[0.05] py-2.5">
                <span className="flex h-8 items-center">{icon as React.ReactNode}</span>
                <span className="text-[10.5px] text-white/60">{label as string}</span>
              </div>
            ))}
          </Stagger>
        </div>
      </>
    ),
  },
  {
    key: "traction", label: "Traction · live",
    render: ({ on, live }) => (
      <>
        <Headline>Where we are, against the plan.</Headline>
        <Body>Our plan to the first 100 customers: 5,000 leads, 1,000 demos, 100 customers.</Body>
        <div className="flex flex-1 items-center gap-5 pt-4">
          {live ? (
            <>
              <Rings on={on} rows={[
                { value: live.goal.leads, target: live.goal.targets.leads, color: C.violet },
                { value: live.goal.demos, target: live.goal.targets.demos, color: "#60a5fa" },
                { value: live.goal.conversions, target: live.goal.targets.conversions, color: C.good },
              ]} />
              <div className="min-w-0 flex-1 space-y-3">
                {[
                  ["Leads", live.goal.leads, live.goal.targets.leads, C.violet],
                  ["Demos", live.goal.demos, live.goal.targets.demos, "#60a5fa"],
                  ["Customers", live.goal.conversions, live.goal.targets.conversions, C.good],
                ].map(([l, v, t, c]) => (
                  <div key={l as string}>
                    <p className="flex items-center gap-1.5 text-[11.5px] text-white/55"><i className="h-2 w-2 rounded-full" style={{ background: c as string }} />{l as string}</p>
                    <p className="text-[19px] font-semibold tabular-nums text-white">
                      {(v as number).toLocaleString("en-IN")}<span className="text-[12px] font-normal text-white/40"> / {(t as number).toLocaleString("en-IN")}</span>
                    </p>
                  </div>
                ))}
                {live.sales && <p className="text-[11.5px] text-white/45">{inr(live.sales.total)} collected</p>}
              </div>
            </>
          ) : (
            <div className="h-36 w-full animate-pulse rounded-2xl bg-white/[0.05]" />
          )}
        </div>
      </>
    ),
  },
  {
    key: "round", label: "The round",
    render: ({ on, live }) => {
      const r = live?.stake.roundInfo;
      const pct = r ? (r.raised / r.target) * 100 : 0;
      return (
        <>
          <Headline>We are raising our pre-seed.</Headline>
          <Body>{r ? `${r.equityOffered}% for ${inr(r.target)}` : "5% for ₹25L"}{live?.stake.valuation ? `, at ${inr(live.stake.valuation)} post-money.` : "."}</Body>
          <div className="flex flex-1 flex-col justify-center gap-3 pt-4">
            <div className="rounded-2xl bg-white/[0.05] px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-white/45">The plan</p>
              <p className="mt-1 text-[14px] text-white">5,000 leads → 1,000 demos → 100 customers</p>
            </div>
            <div className="rounded-2xl bg-white/[0.05] px-4 py-3">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-white/45">Where we are</p>
                <p className="text-[12px] tabular-nums text-white/55">{r ? `${pct.toFixed(0)}% committed` : ""}</p>
              </div>
              {r ? (
                <>
                  <p className="mt-1 text-[14px] text-white">
                    <span className="text-[24px] font-bold tabular-nums tracking-[-0.02em]">{inr(r.raised)}</span>
                    <span className="text-white/50"> of {inr(r.target)}</span>
                  </p>
                  {/* The round as squares of ₹1L: gold ones are in. */}
                  <div className="mt-3 grid grid-cols-10 gap-1.5">
                    {Array.from({ length: Math.round(r.target / 1e5) || 25 }, (_, i) => (
                      <span key={i} className="aspect-square rounded-md"
                        style={{
                          background: i < Math.round(r.raised / 1e5) ? C.money : "rgba(255,255,255,0.09)",
                          opacity: on ? 1 : 0, transform: on ? "none" : "scale(0.6)",
                          transition: `opacity 400ms ${EASE} ${200 + i * 30}ms, transform 400ms ${EASE} ${200 + i * 30}ms`,
                        }} />
                    ))}
                  </div>
                  <p className="mt-2 text-[11.5px] tabular-nums text-white/45">
                    Open {r.daysOpen === 1 ? "since today" : `for ${r.daysOpen} days`} · closes {new Date(r.closesOn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </>
              ) : (
                <div className="mt-2 h-14 animate-pulse rounded-xl bg-white/[0.05]" />
              )}
            </div>
          </div>
        </>
      );
    },
  },
  {
    key: "founder", label: "Who is building it",
    render: ({ on }) => (
      <>
        <div className={`flex items-center gap-4 ${on ? "pitch-in" : "opacity-0"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/thanzeel-ashruf.png" alt="Thanzeel Ashruf" className="h-20 w-20 shrink-0 rounded-full object-cover" style={{ boxShadow: `0 0 0 3px ${C.deep}` }} />
          <div className="min-w-0">
            <p className="text-[19px] font-semibold text-white">Thanzeel Ashruf</p>
            <p className="text-[12.5px] text-white/55">Founder & CEO, PROXe · Founder, BCON Club</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-center pt-5">
          <Headline>Built by a marketer who lost leads too.</Headline>
          <Stagger on={on} className="mt-4 space-y-2" step={110}>
            {[
              "Seven years in marketing across retail, services, hospitality, real estate and healthcare",
              "Runs BCON Club, a growth agency teaching businesses to build with AI",
              "We had this exact problem, in our own businesses and our clients'. We are on a mission to solve it.",
            ].map((t) => (
              <p key={t} className="flex gap-2.5 text-[13.5px] leading-snug text-white/75">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: C.violet }} />{t}
              </p>
            ))}
          </Stagger>
        </div>
        <a href={LINKEDIN} target="_blank" rel="noreferrer"
          className="mt-4 flex items-center justify-between rounded-2xl bg-[#0a66c2] px-4 py-3 text-[14px] font-medium text-white">
          <span className="flex items-center gap-2"><svg viewBox={B.linkedinViewBox} width="16" height="16" aria-hidden><path d={B.linkedin} fill="#fff" /></svg> linkedin.com/in/thanzeelashruf</span>
          <ArrowRight size={16} />
        </a>
      </>
    ),
  },
  {
    key: "talk", hero: true, label: "Talk to PROXe",
    render: ({ setOrb }) => (
      <div className="flex h-full flex-col">
        <p className="text-[13px] font-medium text-white/70">You just read the pitch.</p>
        <h2 className="mt-1 text-[30px] font-semibold leading-[1.05] tracking-[-0.025em] text-white">Now talk to PROXe.</h2>
        <div className="min-h-0 flex-1"><TalkToProxe onActive={setOrb} /></div>
      </div>
    ),
  },
];

function Step({ icon, tint, title, sub, dim = false }: { icon: React.ReactNode; tint: string; title: string; sub: string; dim?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${dim ? "opacity-60" : ""}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: tint }}>{icon}</span>
      <span>
        <span className="block text-[14px] font-medium text-white">{title}</span>
        <span className="text-[12px] text-white/50">{sub}</span>
      </span>
    </div>
  );
}

/** The line between two steps; a leak shows as a broken red dash. */
function Joint({ on, delay, leak = false }: { on: boolean; delay: number; leak?: boolean }) {
  return (
    <div className="ml-[17px] h-5 w-[2px] overflow-hidden">
      <div className="h-full w-full origin-top"
        style={{
          background: leak ? `repeating-linear-gradient(${C.leak} 0 3px, transparent 3px 6px)` : "rgba(255,255,255,0.25)",
          transform: on ? "scaleY(1)" : "scaleY(0)", transition: `transform 400ms ${EASE} ${delay}ms`,
        }} />
    </div>
  );
}

/** PROXe in the middle, every channel around it. */
function Hub({ on }: { on: boolean }) {
  const items: { node: React.ReactNode; label: string }[] = [
    { node: <Brand d={B.whatsapp} color="#25D366" size={20} />, label: "WhatsApp" },
    { node: <Brand d={B.instagram} color="#E4405F" size={19} />, label: "Instagram" },
    { node: <Brand d={B.messenger} color="#0099FF" size={19} />, label: "Messenger" },
    { node: <Phone size={18} className="text-white" />, label: "Voice" },
    { node: <Globe size={18} className="text-white" />, label: "Web chat" },
  ];
  const R = 92;
  return (
    <div className="relative h-[232px] w-[232px]">
      <svg viewBox="0 0 232 232" className="absolute inset-0" aria-hidden>
        <circle cx="116" cy="116" r={R} fill="none" stroke="rgba(167,139,250,0.25)" strokeDasharray="3 5"
          style={{ transformOrigin: "116px 116px", animation: on ? "pitch-spin 24s linear infinite" : "none" }} />
      </svg>
      <div className={`absolute left-1/2 top-1/2 flex h-[76px] w-[76px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ${on ? "pitch-pulse" : ""}`}
        style={{ background: GRAINIENT }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/proxe-logo-white.webp" alt="PROXe" className="w-[52px]" />
      </div>
      {items.map((it, i) => {
        const a = (i / items.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <div key={it.label} className="absolute flex flex-col items-center gap-1"
            style={{
              left: 116 + Math.cos(a) * R, top: 116 + Math.sin(a) * R,
              transform: `translate(-50%, -50%) scale(${on ? 1 : 0.4})`, opacity: on ? 1 : 0,
              transition: `transform 600ms ${EASE} ${200 + i * 110}ms, opacity 400ms ${EASE} ${200 + i * 110}ms`,
            }}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "#211a3f", boxShadow: `0 0 0 1px ${C.line}` }}>{it.node}</span>
            <span className="text-[10px] text-white/55">{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Shrinks a card's content to fit on short screens instead of clipping it. */
function Fit({ children, deps }: { children: React.ReactNode; deps: unknown[] }) {
  const outer = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const [z, setZ] = useState(1);
  useLayoutEffect(() => {
    const o = outer.current, i = inner.current;
    if (!o || !i) return;
    const fit = () => {
      // Measure at natural size, then scale and give back the full height so
      // the card's own spacing (flex-1, h-full) still works.
      i.style.zoom = "1";
      i.style.height = "auto";
      const need = i.scrollHeight, have = o.clientHeight;
      const next = need > have + 1 ? Math.max(0.72, have / need) : 1;
      i.style.zoom = String(next);
      i.style.height = `${have / next}px`;
      setZ(next);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(o);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return (
    <div ref={outer} className="relative min-h-0 flex-1 overflow-hidden">
      <div ref={inner} className="flex flex-col" data-zoom={z}>{children}</div>
    </div>
  );
}

// ── the deck ──

export function PitchDeck() {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [card, setCard] = useState({ w: 380, step: 300, narrow: false });
  const [reduced, setReduced] = useState(false);
  const [live, setLive] = useState<Live | null>(null);
  const [held, setHeld] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [orb, setOrb] = useState(false);
  // Nothing moves or speaks until the viewer starts the pitch (or moves on).
  const [started, setStarted] = useState(false);
  // Narration: a short spoken explainer per card. On unless muted; sound
  // starts on the first tap or key, since browsers block it before that.
  const [narrate, setNarrate] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const clipMs = useRef(0);
  const start = useRef<{ x: number; y: number; t: number; locked: "x" | "y" | null } | null>(null);
  const moved = useRef(false);
  const wheelLock = useRef(0);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const barRef = useRef<HTMLDivElement | null>(null);
  const secRef = useRef<HTMLSpanElement | null>(null);
  const n = SLIDES.length;

  const go = useCallback((i: number) => {
    setIndex(Math.max(0, Math.min(n - 1, i)));
    setHeld(false);
    setStarted(true);
  }, [n]);

  useLayoutEffect(() => {
    const fit = () => {
      const vw = window.innerWidth;
      const narrow = vw < 640;
      const w = Math.min(vw * (narrow ? 0.86 : 0.9), 460);
      setCard({ w, step: narrow ? w * 0.9 : w * 0.66, narrow });
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
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); go(index + 1); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(index - 1); }
      if (e.key === " ") { e.preventDefault(); setUserPaused((p) => !p); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [go, index]);

  useEffect(() => {
    fetch("/api/investor/overview?days=3650").then((r) => (r.ok ? r.json() : null)).then((j) => j && setLive(j)).catch(() => {});
  }, []);

  // ── reading timer: each card gets the time it takes to read, then moves on ──
  const paused = !started || held || userPaused || orb || dragging || index === n - 1;
  // The loop reads `paused` through a ref so pausing keeps the elapsed time.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    const el = cardRefs.current[index];
    const words = (el?.textContent ?? "").trim().split(/\s+/).length;
    // ~240 words a minute, plus a beat for the picture.
    const read = Math.min(20, Math.max(6, Math.round(words / 4) + 3)) * 1000;
    clipMs.current = 0;
    let elapsed = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const stop = pausedRef.current;
      if (!stop && !document.hidden) elapsed += dt;
      // While the voice is on, the card waits for its clip to finish.
      const total = Math.max(read, clipMs.current ? clipMs.current + 1200 : 0);
      const left = Math.max(0, total - elapsed);
      if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(1, elapsed / total)})`;
      if (secRef.current) secRef.current.textContent = stop ? "Paused" : `${Math.ceil(left / 1000)}s`;
      if (elapsed >= total) { go(index + 1); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Restart only when the card changes; pausing must not reset the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, live === null]);

  // Play the current card's clip; stop the last one.
  useEffect(() => {
    const a = audio.current ?? (audio.current = new Audio());
    a.pause();
    if (!narrate || !unlocked) return;
    a.src = `/pitch/audio/${SLIDES[index]!.key}.mp3`;
    a.onloadedmetadata = () => { if (isFinite(a.duration)) clipMs.current = a.duration * 1000; };
    a.play().catch(() => {});
    // Warm the next clip so it starts without a gap.
    const next = SLIDES[index + 1];
    if (next) { const pre = new Audio(); pre.preload = "auto"; pre.src = `/pitch/audio/${next.key}.mp3`; }
  }, [index, narrate, unlocked]);
  // Pausing the deck, or talking to PROXe, silences the narrator.
  useEffect(() => {
    const a = audio.current;
    if (!a || !a.src) return;
    if (userPaused || orb) a.pause();
    else if (narrate && unlocked && !a.ended) a.play().catch(() => {});
  }, [userPaused, orb, narrate, unlocked]);
  useEffect(() => {
    try { if (localStorage.getItem("pitch-narrate") === "off") setNarrate(false); } catch { /* storage blocked */ }
    const unlock = () => setUnlocked(true);
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); audio.current?.pause(); };
  }, []);
  function toggleNarration() {
    const on = !narrate;
    setNarrate(on);
    setUnlocked(true);
    if (!on) { audio.current?.pause(); clipMs.current = 0; }
    try { localStorage.setItem("pitch-narrate", on ? "on" : "off"); } catch { /* storage blocked */ }
  }

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
      const edge = (index === 0 && dx > 0) || (index === n - 1 && dx < 0);
      setDrag(edge ? dx * 0.3 : dx);
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    const s = start.current;
    start.current = null;
    if (!s || s.locked !== "x") { setDragging(false); setDrag(0); return; }
    const dx = e.clientX - s.x;
    const v = dx / Math.max(1, performance.now() - s.t);
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
  const maxRot = card.narrow ? 28 : 38;

  return (
    <div className="fixed inset-0 flex select-none flex-col overflow-hidden text-white" style={{ background: C.page }}>
      <style>{`
        @keyframes pitch-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .pitch-in { animation: pitch-in 650ms ${EASE} both; }
        @keyframes pitch-spin { to { transform: rotate(360deg); } }
        @keyframes pitch-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.45); } 50% { box-shadow: 0 0 0 14px rgba(124,58,237,0); } }
        .pitch-pulse { animation: pitch-pulse 2.6s ease-in-out infinite; }
        @keyframes pitch-drift { from { transform: translate3d(-2%, -1%, 0) scale(1); } to { transform: translate3d(2%, 1.5%, 0) scale(1.06); } }
        .pitch-glow { animation: pitch-drift 18s ease-in-out infinite alternate; }
        @media (prefers-reduced-motion: reduce) { .pitch-in, .pitch-pulse, .pitch-glow { animation: none !important; opacity: 1 !important; } }
      `}</style>
      {/* Violet glow behind the deck, drifting slowly */}
      <div className="pitch-glow pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.42) 0%, rgba(124,58,237,0) 65%)" }} />
        <div className="absolute -left-[15vmin] -top-[20vmin] h-[60vmin] w-[60vmin] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(76,29,149,0.55) 0%, rgba(76,29,149,0) 65%)" }} />
        <div className="absolute -bottom-[25vmin] -right-[10vmin] h-[65vmin] w-[65vmin] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(167,139,250,0.22) 0%, rgba(167,139,250,0) 65%)" }} />
      </div>
      {/* The site's grain, very faint */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: GRAIN }} />

      <header className="relative z-10 flex items-center justify-between px-5 pt-[max(16px,env(safe-area-inset-top))] sm:px-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/proxe-logo-white.webp" alt="PROXe" className="h-5 w-auto opacity-90" />
        <div className="flex items-center gap-2">
          <button onClick={toggleNarration} aria-pressed={narrate}
            className="flex h-10 items-center gap-2 rounded-full bg-white/[0.07] px-3.5 text-[12.5px] text-white/80 backdrop-blur-md transition-colors hover:text-white">
            {narrate ? <Volume2 size={16} /> : <VolumeX size={16} />}
            {narrate ? (unlocked ? "Narration on" : "Tap to listen") : "Narration off"}
          </button>
          <Link href="/dashboard" aria-label="Close the pitch" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.07] text-white/70 backdrop-blur-md transition-colors hover:text-white">
            <X size={17} />
          </Link>
        </div>
      </header>

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
          const rot = reduced ? 0 : -sign * Math.min(a, 1) * maxRot;
          const z = reduced ? 0 : -Math.min(a, 3) * 150;
          const scale = 1 - Math.min(a, 3) * (reduced ? 0.06 : 0.03);
          const current = i === index;
          return (
            <article
              key={s.key}
              ref={(el) => { cardRefs.current[i] = el; }}
              aria-hidden={!current}
              aria-label={`${i + 1} of ${n}: ${s.label}`}
              onClick={() => { if (!current && !moved.current) go(i); }}
              onPointerDown={() => { if (current) setHeld(true); }}
              className="absolute left-1/2 top-1/2 flex flex-col overflow-hidden rounded-[28px] px-6 pb-6 pt-5 sm:px-7 sm:pb-7"
              style={{
                width: card.w,
                // Wider than tall-and-thin: capped by the screen, 560px, and 1.45x the width.
                height: `min(calc(100dvh - 160px), 560px, ${Math.round(card.w * 1.45)}px)`,
                marginLeft: -card.w / 2,
                transform: `translate3d(${x}px, -50%, ${z}px) rotateY(${rot}deg) scale(${scale})`,
                transition: dragging ? "none" : `transform 620ms ${EASE}`,
                zIndex: 100 - Math.round(a * 10),
                background: s.hero ? GRAINIENT : "linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 38%, rgba(255,255,255,0) 60%), rgba(22,17,43,0.72)",
                backdropFilter: !s.hero && a < 0.5 ? "blur(22px) saturate(150%)" : undefined,
                WebkitBackdropFilter: !s.hero && a < 0.5 ? "blur(22px) saturate(150%)" : undefined,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,${s.hero ? 0.25 : 0.14}), 0 0 0 1px ${s.hero ? "rgba(255,255,255,0.18)" : C.line}, 0 30px 70px -24px rgba(0,0,0,0.75)`,
                willChange: "transform",
                cursor: current ? "grab" : "pointer",
              }}
            >
              {s.hero && <div className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />}

              {/* Label and reading timer */}
              <div className="relative mb-4 flex items-center justify-between gap-3">
                <p className="text-[12px] font-medium" style={{ color: s.hero ? "rgba(255,255,255,0.75)" : C.violet }}>{s.label}</p>
                {current && started && i < n - 1 && (
                  <button onClick={(e) => { e.stopPropagation(); setUserPaused((p) => !p); }}
                    className="flex items-center gap-1.5 rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] tabular-nums text-white/70"
                    aria-label={paused ? "Resume auto-advance" : "Pause auto-advance"}>
                    {paused ? <Play size={10} /> : <Pause size={10} />}
                    <span ref={secRef}>…</span>
                  </button>
                )}
              </div>
              {current && i < n - 1 && (
                <div className="absolute inset-x-0 top-0 h-[3px] bg-white/[0.06]">
                  <div ref={barRef} className="h-full origin-left" style={{ background: s.hero ? "#fff" : C.violet, transform: "scaleX(0)" }} />
                </div>
              )}

              <Fit deps={[card.w, live === null, current]}>{s.render({ on: current, live, setOrb, started, start: () => { setStarted(true); setUnlocked(true); setHeld(false); } })}</Fit>

              {/* Side cards sink back, but stay visible as more to come */}
              <div className="pointer-events-none absolute inset-0 rounded-[28px]"
                style={{ background: C.page, opacity: Math.min(a, 1.6) * 0.38, transition: dragging ? "none" : `opacity 620ms ${EASE}` }} />
            </article>
          );
        })}
      </div>

      <footer className="relative z-10 flex items-center justify-between gap-4 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 sm:px-8">
        <button onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous card"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-white transition-opacity disabled:opacity-25">
          <ArrowLeft size={18} />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
          {SLIDES.map((s, i) => (
            <button key={s.key} onClick={() => go(i)} aria-label={`Go to ${s.label}`}
              className="flex h-11 items-center transition-[width] duration-300" style={{ width: i === index ? 26 : 9 }}>
              <span className="block h-1.5 w-full rounded-full transition-colors duration-300"
                style={{ background: i === index ? C.violet : i < index ? "rgba(167,139,250,0.45)" : "rgba(255,255,255,0.16)" }} />
            </button>
          ))}
        </div>
        <button onClick={() => go(index + 1)} disabled={index === n - 1} aria-label="Next card"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-25"
          style={{ background: C.deep }}>
          <ArrowRight size={18} />
        </button>
      </footer>
    </div>
  );
}
