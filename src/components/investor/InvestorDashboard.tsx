"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, LogOut, Megaphone, Wallet, Newspaper, Pin, Target,
  Users, Code2, Handshake, BarChart3, Smartphone, MapPin, MousePointerClick, Gauge, Settings2, Star, BadgeCheck, Bell, Inbox, Radar, Presentation, Link2, Repeat, Activity, CalendarCheck, Home, TrendingUp,
} from "lucide-react";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { StatusPill } from "@/components/ui/StatusPill";
import { money, moneyShort } from "@/lib/format";
import type { AdsDesk, DaySpend, FeedItem, InvestorOverview, SiteVisitors } from "@/lib/investor/data";

type Range = "7" | "30" | "3650";
type View = "home" | "growth" | "money" | "analytics" | "updates";

const TABS: { key: View; label: string; icon: typeof Wallet }[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "growth", label: "Growth", icon: TrendingUp },
  { key: "money", label: "Money", icon: Wallet },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "updates", label: "Updates", icon: Bell },
];

const RANGE_TABS: { value: Range; label: string }[] = [
  { value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "3650", label: "All time" },
];
const RANGE_LABEL: Record<Range, string> = { "7": "last 7 days", "30": "last 30 days", "3650": "all time" };

const CATEGORY_LABEL: Record<string, string> = {
  ad_topup: "Ads",
  tools: "Tools & software",
  infra: "Infrastructure",
  calls: "Calling",
  people: "People",
  marketing: "Marketing",
  legal: "Legal",
  equipment: "Equipment",
  other: "Other",
};

const FEED_STAGE: Record<string, { label: string; tone: "info" | "warn" | "good" }> = {
  plan: { label: "Plan", tone: "info" },
  executing: { label: "In motion", tone: "warn" },
  done: { label: "Done", tone: "good" },
};

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp", web: "Website", voice: "Voice", social: "Instagram / social",
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function fmtDateTime(s: string) {
  return new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
function delta(cur: number, prev: number) {
  if (!prev) return cur ? "new this period" : "";
  const d = ((cur - prev) / prev) * 100;
  return `${d >= 0 ? "+" : ""}${d.toFixed(0)}% vs previous`;
}

function Card({ title, icon: Icon, sub, children, className = "" }: {
  title: string; icon: typeof Wallet; sub?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-panel bg-surface p-4 sm:p-5 ${className}`}>
      <header className="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <Icon size={14} className="shrink-0 translate-y-[2px] text-[var(--brand-text)]" />
        <h2 className="shrink-0 text-[13px] font-semibold text-text">{title}</h2>
        {sub && <span className="text-[11px] text-text-muted">{sub}</span>}
      </header>
      {children}
    </section>
  );
}

/** Divides the page into its parts: the investment, the business, the detail. */
function SectionHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pt-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-text sm:text-[17px]">{title}</h2>
        {sub && <p className="mt-0.5 text-[11.5px] text-text-muted">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

/** One line of a money statement: label on the left, amount on the right. */
function MoneyLine({ label, hint, value, tone, dept }: { label: string; hint?: string; value: string; tone?: "in" | "out" | "total"; dept?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-2 ${tone === "total" ? "mt-1 rounded-card bg-[var(--surface-hover)] px-3" : ""}`}>
      <div className="min-w-0">
        <p className={`flex flex-wrap items-center gap-2 text-[13px] ${tone === "total" ? "font-semibold text-text" : "text-text"}`}>{label}{dept && <DeptChip name={dept} />}</p>
        {hint && <p className="text-[10.5px] text-text-muted">{hint}</p>}
      </div>
      <p className={`shrink-0 text-[15px] font-semibold tabular-nums ${tone === "in" ? "text-accent-green" : "text-text"}`}>{value}</p>
    </div>
  );
}

function Bar({ value, tone = "brand" }: { value: number; tone?: "brand" | "blue" }) {
  return (
    <div className="h-2 overflow-hidden rounded-pill bg-[var(--surface-hover)]">
      <div
        className={`h-full rounded-pill ${tone === "brand" ? "bg-[var(--brand)]" : "bg-accent-blue"}`}
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

/** Daily money out since the first spend: ads (lime) under everything else (blue). */
function SpendBars({ daily }: { daily: DaySpend[] }) {
  const max = Math.max(1, ...daily.map((d) => d.ads + d.other));
  const [hover, setHover] = useState<number | null>(null);
  const h = hover != null ? daily[hover] : null;
  return (
    <div>
      <div className="mb-2 flex min-h-5 flex-wrap items-center gap-3 text-[11px] text-text-muted">
        {h ? (
          <span className="tabular-nums text-text">{fmtDate(h.day)}: {money(h.ads + h.other)}</span>
        ) : (
          <>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-[#c084fc]" />Marketing (ads)</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-accent-blue" />Everything else</span>
          </>
        )}
      </div>
      <div className="flex h-28 items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
        {daily.map((d, i) => {
          const total = d.ads + d.other;
          return (
            <div key={d.day} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}
              className="flex h-full min-w-[6px] max-w-[48px] flex-1 flex-col justify-end" title={`${d.day}: ${money(total)}`}>
              <div className="w-full rounded-t-[3px] bg-accent-blue opacity-80" style={{ height: `${(d.other / max) * 100}%` }} />
              <div className={`w-full bg-[#c084fc] ${d.other ? "" : "rounded-t-[3px]"}`} style={{ height: `${(d.ads / max) * 100}%`, minHeight: total ? 2 : 0 }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-text-muted">
        <span>{daily[0] && fmtDate(daily[0].day)}</span>
        <span>{daily.length > 1 && "today"}</span>
      </div>
    </div>
  );
}

/** The icon says which department is behind an item, at a glance. */
// Each department keeps one colour everywhere: chip, bar, and its spends in the feed.
const DEPT: Record<string, { icon: typeof Wallet; label: string; chip: string; bar: string; box: string; ring: string }> = {
  Marketing: {
    icon: Megaphone, label: "Marketing",
    chip: "border-[#c084fc]/60 bg-[#c084fc]/15 text-[#d8b4fe]", bar: "bg-[#c084fc]",
    box: "border-[#c084fc]/45 bg-[#c084fc]/[0.08]", ring: "border-[#c084fc]/60 text-[#c084fc]",
  },
  Sales: {
    icon: Handshake, label: "Sales",
    chip: "border-accent-orange/60 bg-accent-orange/15 text-accent-orange", bar: "bg-accent-orange",
    box: "border-accent-orange/40 bg-accent-orange/[0.07]", ring: "border-accent-orange/60 text-accent-orange",
  },
  Engineering: {
    icon: Code2, label: "Engineering",
    chip: "border-[#22d3ee]/55 bg-[#22d3ee]/12 text-[#67e8f9]", bar: "bg-[#22d3ee]",
    box: "border-[#22d3ee]/40 bg-[#22d3ee]/[0.07]", ring: "border-[#22d3ee]/60 text-[#22d3ee]",
  },
  Operations: {
    icon: Settings2, label: "Operations",
    chip: "border-accent-blue/55 bg-accent-blue/12 text-accent-blue", bar: "bg-accent-blue",
    box: "border-accent-blue/30 bg-accent-blue/[0.06]", ring: "border-accent-blue/50 text-accent-blue",
  },
};
const deptOf = (name: string | null | undefined) => DEPT[name ?? ""] ?? DEPT.Operations!;

/** Which department a thing belongs to: icon, name, its colour. */
function DeptChip({ name }: { name: string | null | undefined }) {
  const d = deptOf(name);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 text-[10.5px] font-semibold ${d.chip}`}>
      <d.icon size={11} /> {name || d.label}
    </span>
  );
}

/** Demos booked (brand) and payment links shared (gold), per day; weeks past six weeks. */
function ActivityBars({ daily: days }: { daily: { day: string; demos: number; links: number }[] }) {
  const daily = days.length <= 45 ? days : days.reduce<{ day: string; demos: number; links: number }[]>((out, d, i) => {
    if (i % 7 === 0) out.push({ day: d.day, demos: 0, links: 0 });
    const w = out[out.length - 1]!;
    w.demos += d.demos;
    w.links += d.links;
    return out;
  }, []);
  const max = Math.max(1, ...daily.map((d) => d.demos + d.links));
  const [hover, setHover] = useState<number | null>(null);
  const h = hover != null ? daily[hover] : null;
  return (
    <div>
      <div className="mb-2 flex min-h-5 flex-wrap items-center gap-3 text-[11px] text-text-muted">
        {h ? (
          <span className="tabular-nums text-text">{fmtDate(h.day)}{days.length > 45 ? " week" : ""}: {h.demos} demo{h.demos === 1 ? "" : "s"} booked · {h.links} link{h.links === 1 ? "" : "s"}</span>
        ) : (
          <>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-[var(--brand)]" />Demos booked</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-[#e8b931]" />Payment links</span>
          </>
        )}
      </div>
      <div className="flex h-28 items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
        {daily.map((d, i) => (
          <div key={d.day} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}
            className="flex h-full min-w-0 max-w-[40px] flex-1 flex-col justify-end" title={`${d.day}: ${d.demos} demos, ${d.links} links`}>
            <div className="w-full rounded-t-[3px] bg-[#e8b931]" style={{ height: `${(d.links / max) * 100}%` }} />
            <div className={`w-full bg-[var(--brand)] ${d.links ? "" : "rounded-t-[3px]"}`} style={{ height: `${(d.demos / max) * 100}%` }} />
            {!d.demos && !d.links && <div className="h-[2px] w-full rounded-pill bg-[var(--surface-hover)]" />}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-text-muted">
        <span>{daily[0] && fmtDate(daily[0].day)}</span>
        <span>today</span>
      </div>
    </div>
  );
}

/** Grey blocks in the page's shape while the live numbers arrive. */
function Skeleton() {
  const block = "animate-pulse rounded-panel bg-surface";
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-5 w-40 animate-pulse rounded-pill bg-surface" />
      <div className={`${block} h-56`} />
      <div className="h-5 w-32 animate-pulse rounded-pill bg-surface" />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className={`${block} h-64 lg:col-span-3`} />
        <div className={`${block} h-64 lg:col-span-2`} />
      </div>
      <div className={`${block} h-48`} />
    </div>
  );
}

function FeedIcon({ item }: { item: FeedItem }) {
  const Icon = deptOf(item.department).icon;
  const ring =
    item.tone === "paid" ? "border-accent-green/60 text-accent-green"
    : item.tone === "sales" ? "border-[#e8b931]/60 text-[#e8b931]"
    : item.tone === "spend" ? deptOf(item.department).ring
    : "border-[var(--brand-line)] text-[var(--brand-text)]";
  return (
    <span className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-surface ${ring}`}>
      <Icon size={13} />
    </span>
  );
}

function Feed({ items }: { items: FeedItem[] }) {
  if (!items.length) {
    return <p className="text-[12.5px] text-text-muted">Nothing posted yet. Plans, launches and money moved appear here as they happen.</p>;
  }
  return (
    <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-[var(--border)]">
      {items.map((item) => {
        const stage = item.stage ? FEED_STAGE[item.stage] : null;
        const box =
          item.tone === "paid"
            ? "border-accent-green/50 bg-accent-green/[0.10]"
            : item.tone === "sales"
            ? "border-[#e8b931]/45 bg-[#e8b931]/[0.08]"
            : item.tone === "spend"
              ? deptOf(item.department).box
              : "border-[var(--border)] bg-[var(--surface-hover)]";
        return (
          <li key={item.id} className="flex gap-3">
            <FeedIcon item={item} />
            <div className={`min-w-0 flex-1 rounded-card p-3 ${box}`}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {item.tone === "sales" && <Star size={13} className="shrink-0 fill-[#e8b931] text-[#e8b931]" aria-label="Conversion" />}
                {item.tone === "paid" && <BadgeCheck size={14} className="shrink-0 text-accent-green" aria-label="Payment received" />}
                <h3 className={`text-[13.5px] font-semibold leading-snug ${item.tone === "sales" ? "text-[#f0c84b]" : item.tone === "paid" ? "text-accent-green" : "text-text"}`}>{item.title}</h3>
                {stage && <StatusPill status={stage.label} tone={stage.tone} />}
                <DeptChip name={item.department} />
                {item.pinned && <Pin size={11} className="text-[var(--brand-text)]" aria-label="Pinned" />}
              </div>
              <p className="mt-0.5 text-[10.5px] tabular-nums text-text-muted">{fmtDateTime(item.at)}</p>
              {item.body && <p className="mt-1.5 whitespace-pre-line break-words text-[12.5px] leading-relaxed text-text-muted">{item.body}</p>}
              {item.detail && (item.detail.daily_budget || item.detail.targeting) && (
                <div className="mt-2.5 space-y-2 rounded-card bg-[var(--bg)] p-3">
                  {item.detail.daily_budget != null && (
                    <p className="text-[12px] text-text">
                      <span className="text-text-muted">Daily budget </span>
                      <span className="font-semibold tabular-nums">{money(item.detail.daily_budget)}</span>
                      <span className="text-text-muted"> · about {money(item.detail.daily_budget * 30)} a month</span>
                    </p>
                  )}
                  {item.detail.targeting && (
                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-text-muted"><Target size={11} /> Targeting</p>
                      <p className="whitespace-pre-line text-[12px] leading-relaxed text-text">{item.detail.targeting}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** One row of a horizontal bar list: label, filled track, value. */
function HBar({ label, sub, value, max, display, tone = "brand" }: {
  label: string; sub?: string; value: number; max: number; display: string; tone?: "brand" | "good" | "bad" | "muted";
}) {
  const fill = tone === "good" ? "bg-accent-green" : tone === "bad" ? "bg-accent-red" : tone === "muted" ? "bg-text-muted/50" : "bg-[var(--brand)]";
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
      <div className="min-w-0">
        <p className="truncate text-[12.5px] text-text">{label}</p>
        {sub && <p className="truncate text-[10.5px] text-text-muted">{sub}</p>}
      </div>
      <span className="self-end text-[12.5px] font-semibold tabular-nums text-text">{display}</span>
      <div className="col-span-2 h-2 overflow-hidden rounded-pill bg-[var(--surface-hover)]">
        <div className={`h-full rounded-pill ${fill}`} style={{ width: `${max ? Math.max(value ? 2 : 0, (value / max) * 100) : 0}%` }} />
      </div>
    </li>
  );
}

/** Site visitors: who comes to goproxe.com from the ads and what they do there. */
function SiteSection({ s }: { s: SiteVisitors }) {
  const mobile = s.devices?.find((d) => d.name === "Mobile");
  const totalDev = (s.devices ?? []).reduce((t, d) => t + d.visits, 0);
  const maxCity = Math.max(1, ...(s.cities ?? []).map((c) => c.visits));
  const maxPlace = Math.max(1, ...(s.placements ?? []).map((p) => p.visits));
  const maxAd = Math.max(1, ...(s.adsEngagement ?? []).map((p) => p.visits));
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const loadSec = s.medianLoadMs ? s.medianLoadMs / 1000 : null;
  return (
    <>
      <SectionHead title="Site visitors" sub="goproxe.com, from Microsoft Clarity" />
      <section className="overflow-hidden rounded-panel bg-surface">
        <dl className="grid grid-cols-2 sm:grid-cols-4">
          {[
            { k: "Visits", v: s.sessions.toLocaleString("en-IN"), h: s.users ? `${s.users.toLocaleString("en-IN")} people` : "" },
            { k: "On mobile", v: mobile && totalDev ? `${pct(mobile.visits, totalDev)}%` : "–", h: "of visits" },
            { k: "Scroll depth", v: mobile ? `${Math.round(mobile.scroll)}%` : "–", h: "average, mobile" },
            { k: "Time on page", v: s.medianActiveSeconds != null ? `${s.medianActiveSeconds}s` : s.mobileSeconds != null ? `${s.mobileSeconds}s` : "–", h: "median, ad visits" },
          ].map((x) => (
            <div key={x.k} className="p-3 sm:p-4">
              <dt className="text-[10.5px] uppercase tracking-[0.08em] text-text-muted">{x.k}</dt>
              <dd className="mt-1 text-[20px] font-semibold tabular-nums text-text">{x.v}</dd>
              <dd className="text-[10.5px] text-text-muted">{x.h}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Card title="What ad visitors do" icon={MousePointerClick} sub={`${s.sample} recent ad visits`}>
        <div className="flex h-3 gap-0.5 overflow-hidden rounded-pill">
          <div className="bg-accent-red" style={{ flex: s.bounced }} title="left within 10 seconds" />
          <div className="bg-text-muted/40" style={{ flex: s.noClick }} title="stayed, clicked nothing" />
          <div className="bg-accent-green" style={{ flex: s.clicked }} title="clicked something" />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-muted">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-accent-red" />left in under 10s · {pct(s.bounced, s.sample)}%</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-text-muted/40" />looked, no click · {pct(s.noClick, s.sample)}%</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-accent-green" />clicked · {pct(s.clicked, s.sample)}%</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {s.typed != null && (
            <div className="rounded-card bg-[var(--surface-hover)] p-3">
              <p className="text-[10.5px] uppercase tracking-[0.08em] text-text-muted">Typed in a form</p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums text-text">{s.typed}</p>
              <p className="text-[10.5px] text-text-muted">of {s.sample} visits</p>
            </div>
          )}
          {s.morePages != null && (
            <div className="rounded-card bg-[var(--surface-hover)] p-3">
              <p className="text-[10.5px] uppercase tracking-[0.08em] text-text-muted">Saw a second page</p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums text-text">{s.morePages}</p>
              <p className="text-[10.5px] text-text-muted">of {s.sample} visits</p>
            </div>
          )}
        </div>
        {s.topClicks && s.topClicks.length > 0 && (
          <>
            <p className="mb-1.5 mt-4 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-text-muted">What they tap</p>
            <div className="flex flex-wrap gap-1.5">
              {s.topClicks.map((c) => (
                <span key={c.label} className="rounded-pill bg-[var(--surface-hover)] px-2.5 py-1 text-[11.5px] text-text-muted">
                  {c.label} <span className="font-semibold tabular-nums text-text">{c.count}</span>
                </span>
              ))}
            </div>
          </>
        )}
      </Card>

      {s.adsEngagement && s.adsEngagement.length > 0 && (
        <Card title="Which ad brings engaged visitors" icon={Megaphone} sub="visits, and how many tapped anything">
          <ul className="space-y-3">
            {s.adsEngagement.map((a) => (
              <HBar key={a.name} label={a.name} max={maxAd} value={a.visits} tone={pct(a.engaged, a.visits) >= 20 ? "good" : "brand"}
                sub={`${a.engaged} of ${a.visits} tapped something · ${pct(a.engaged, a.visits)}%`} display={`${a.visits} visits`} />
            ))}
          </ul>
        </Card>
      )}

      {s.placements && s.placements.length > 0 && (
        <Card title="Where on Facebook and Instagram they came from" icon={Smartphone} sub="placement">
          <ul className="space-y-3">
            {s.placements.map((p) => (
              <HBar key={p.name} label={p.name} max={maxPlace} value={p.visits} tone={pct(p.engaged, p.visits) >= 20 ? "good" : "brand"}
                sub={`${p.engaged} engaged · ${pct(p.engaged, p.visits)}%`} display={`${p.visits}`} />
            ))}
          </ul>
        </Card>
      )}

      {(s.cities?.length || s.devices?.length) ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {s.cities && s.cities.length > 0 && (
            <Card title="Cities" icon={MapPin} sub="ad visitors">
              <ul className="space-y-3">
                {s.cities.map((c) => <HBar key={c.name} label={c.name} max={maxCity} value={c.visits} display={String(c.visits)} />)}
              </ul>
            </Card>
          )}
          {s.devices && s.devices.length > 0 && (
            <Card title="Devices" icon={Smartphone} sub="visits · scroll depth">
              <ul className="space-y-3">
                {s.devices.map((d) => <HBar key={d.name} label={d.name} sub={`scrolls ${Math.round(d.scroll)}% of the page`} max={totalDev || 1} value={d.visits} display={String(d.visits)} />)}
              </ul>
            </Card>
          )}
        </div>
      ) : null}

      {(loadSec != null || s.medianLcpSeconds != null) && (
        <Card title="Page speed" icon={Gauge} sub="median, ad visits">
          <div className="grid grid-cols-2 gap-2">
            {loadSec != null && (
              <div className={`rounded-card p-3 ${loadSec > 3 ? "bg-accent-red/[0.10]" : "bg-accent-green/[0.10]"}`}>
                <p className="text-[10.5px] uppercase tracking-[0.08em] text-text-muted">Full page load</p>
                <p className="mt-1 text-[20px] font-semibold tabular-nums text-text">{loadSec.toFixed(1)}s</p>
                <p className="text-[10.5px] text-text-muted">{loadSec > 3 ? "slow on mobile data" : "fine"}</p>
              </div>
            )}
            {s.medianLcpSeconds != null && (
              <div className={`rounded-card p-3 ${s.medianLcpSeconds > 2.5 ? "bg-accent-red/[0.10]" : "bg-accent-green/[0.10]"}`}>
                <p className="text-[10.5px] uppercase tracking-[0.08em] text-text-muted">Main content shows</p>
                <p className="mt-1 text-[20px] font-semibold tabular-nums text-text">{s.medianLcpSeconds.toFixed(1)}s</p>
                <p className="text-[10.5px] text-text-muted">{s.medianLcpSeconds > 2.5 ? "slow" : "good"}</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </>
  );
}

/** The Analytics tab: what PROXe has spent on ads since 1 Oct, what is running, and what it bought. */
function AdsView({ d }: { d: AdsDesk }) {
  const maxDay = Math.max(1, ...d.daily.map((x) => x.spend));
  const maxCamp = Math.max(1, ...d.campaigns.map((c) => c.spend));
  const cpls = d.campaigns.map((c) => c.cpl).filter((x): x is number => x != null);
  const best = cpls.length ? Math.min(...cpls) : null;
  const tone = (cpl: number | null): "good" | "bad" | "brand" =>
    cpl == null ? "bad" : best != null && cpl <= best * 1.15 ? "good" : best != null && cpl >= best * 2 ? "bad" : "brand";
  const maxAdLeads = Math.max(1, ...d.ads.map((a) => a.leads));
  const steps = [
    { label: "Leads from ads", value: d.funnel.fromAds },
    { label: "Replied", value: d.funnel.replied },
    { label: "Demo booked", value: d.funnel.booked },
    { label: "Demo done", value: d.funnel.demos },
    { label: "Paid", value: d.funnel.paid },
  ];
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-panel bg-surface">
        <div className="bg-[var(--brand-faint)] p-4 sm:p-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-text)]">Spent on ads since {fmtDate(d.since)}</p>
          <p className="mt-1 text-[34px] font-semibold leading-none tracking-tight tabular-nums text-text sm:text-[40px]">{money(Math.round(d.spend))}</p>
          <p className="mt-1.5 text-[12px] text-text-muted">Facebook + Instagram · as of {fmtDateTime(d.takenAt)}</p>
        </div>
        <dl className="grid grid-cols-3">
          {[
            { k: "Leads", v: String(d.leads), h: `into PROXe · Meta counts ${d.metaLeads}` },
            { k: "Cost per lead", v: d.cpl != null ? money(Math.round(d.cpl)) : "–", h: "spend ÷ leads" },
            { k: "Link clicks", v: d.clicks ? d.clicks.toLocaleString("en-IN") : "–", h: d.impressions ? `${d.impressions.toLocaleString("en-IN")} views` : "" },
          ].map((x) => (
            <div key={x.k} className="p-3 sm:p-4">
              <dt className="text-[10.5px] uppercase tracking-[0.08em] text-text-muted">{x.k}</dt>
              <dd className="mt-1 text-[20px] font-semibold tabular-nums text-text">{x.v}</dd>
              <dd className="text-[10.5px] text-text-muted">{x.h}</dd>
            </div>
          ))}
        </dl>
      </section>

      {d.daily.length > 0 && (
        <Card title="Spend by day" icon={Wallet} sub={`since ${fmtDate(d.since)}`}>
          <div className="flex h-28 items-end gap-1">
            {d.daily.map((x) => (
              <div key={x.day} className="flex h-full flex-1 flex-col justify-end" title={`${fmtDate(x.day)}: ${money(Math.round(x.spend))}${x.leads ? ` · ${x.leads} leads` : ""}`}>
                <div className="w-full rounded-t-[3px] bg-[#c084fc]" style={{ height: `${(x.spend / maxDay) * 100}%`, minHeight: x.spend ? 2 : 0 }} />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-text-muted">
            <span>{fmtDate(d.daily[0].day)}</span><span>{fmtDate(d.daily[d.daily.length - 1].day)}</span>
          </div>
        </Card>
      )}

      <Card title="Campaigns" icon={Megaphone} sub="spend and cost per lead">
        {d.campaigns.length === 0 ? <p className="text-[12px] text-text-muted">No campaign spent money in this window.</p> : (
          <ul className="space-y-3">
            {d.campaigns.map((c) => (
              <HBar key={c.name} label={c.name} max={maxCamp} value={c.spend} tone={tone(c.cpl)}
                sub={`${c.status === "Active" ? "Running" : "Stopped"} · ${c.results} lead${c.results === 1 ? "" : "s"} · ${c.cpl != null ? `${money(Math.round(c.cpl))} per lead` : "no leads yet"}`}
                display={money(Math.round(c.spend))} />
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-text-muted">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-accent-green" />cheapest leads</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-accent-red" />twice the cheapest, or none</span>
        </div>
      </Card>

      {d.ads.length > 0 && (
        <Card title="Ads running" icon={Megaphone} sub="spend and leads per creative, Meta's count">
          <ul className="space-y-3">
            {d.ads.map((a) => (
              <HBar key={`${a.name}|${a.campaign}`} label={a.name} max={maxAdLeads} value={a.leads}
                tone={a.leads ? "good" : "muted"}
                sub={[a.campaign, a.status === "Active" ? "running" : a.status.toLowerCase(), a.cpl != null ? `${money(Math.round(a.cpl))} per lead` : null].filter(Boolean).join(" · ")}
                display={`${a.leads} lead${a.leads === 1 ? "" : "s"}`} />
            ))}
          </ul>
        </Card>
      )}

      <Card title="What the ads bought" icon={Target} sub={`since ${fmtDate(d.since)}`}>
        <ul className="space-y-3">
          {steps.map((s, i) => (
            <HBar key={s.label} label={s.label} max={Math.max(1, steps[0].value)} value={s.value} display={String(s.value)}
              tone={i === steps.length - 1 ? (s.value ? "good" : "bad") : "brand"} />
          ))}
        </ul>
        <p className="mt-3 text-[10.5px] text-text-muted">
          {d.funnel.leads} leads in total since {fmtDate(d.since)}, {d.funnel.fromAds} of them from ads. Bookings and demos come from the team&apos;s call notes and chats.
        </p>
      </Card>

      {d.site && <SiteSection s={d.site} />}

      {d.notes.length > 0 && (
        <ul className="space-y-1 px-1 text-[10.5px] text-text-muted">
          {d.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}

export function InvestorDashboard({ role, viewAs = null }: { role: "owner" | "investor"; viewAs?: string | null }) {
  const [range, setRange] = useState<Range>("3650");
  const [view, setView] = useState<View>("home");
  const [data, setData] = useState<InvestorOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    // A dropped connection or a stuck request must end in a message, not an
    // endless skeleton.
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 45_000);
    try {
      const res = await fetch(`/api/investor/overview?days=${range}${viewAs ? `&as=${viewAs}` : ""}`, { signal: ctl.signal });
      if (res.status === 401) { window.location.href = "/investor/login"; return; }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) { setError("The numbers did not load."); return; }
      setData(json);
    } catch {
      setError("The numbers did not load. Check the connection.");
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [range, viewAs]);

  useEffect(() => { load(); }, [load]);
  // Live numbers are cached for five minutes server side; refresh on that beat.
  useEffect(() => {
    const t = setInterval(load, 5 * 60_000);
    return () => clearInterval(t);
  }, [load]);

  // What arrived since this viewer last looked. Kept in the browser only:
  // a convenience, so losing it just shows the last two days again.
  const seenKey = data ? `proxe-investor-seen:${data.viewer.name}` : null;
  const [seenAt, setSeenAt] = useState<string | null>(null);
  useEffect(() => {
    if (!seenKey) return;
    let v: string | null = null;
    try { v = localStorage.getItem(seenKey); } catch { /* storage blocked */ }
    setSeenAt(v ?? new Date(Date.now() - 2 * 864e5).toISOString());
  }, [seenKey]);
  const fresh = data && seenAt ? data.feed.filter((f) => f.at > seenAt) : [];
  function markSeen() {
    const now = new Date().toISOString();
    setSeenAt(now);
    try { if (seenKey) localStorage.setItem(seenKey, now); } catch { /* storage blocked */ }
  }

  async function logout() {
    await fetch("/api/investor/logout", { method: "POST" });
    window.location.href = "/investor/login";
  }

  const st = data?.stake;
  const m = data?.money;
  const owner = data?.viewer.role === "owner";
  const sp = data?.spend.ok ? data.spend.data : null;

  const newCount = fresh.length;
  function go(v: View) {
    setView(v);
    window.scrollTo({ top: 0 });
  }
  function openUpdates() {
    go("updates");
    markSeen();
  }
  const f = data?.funnel;

  return (
    <div className="min-h-screen overflow-x-hidden bg-bg">
      {role === "owner" && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--brand-faint)] px-4 py-2 text-[12px] text-[var(--brand-text)] sm:px-8">
          <span>{viewAs && data ? `Viewing as ${data.viewer.name}: exactly their screen.` : "Preview: exactly what investors see. Each sees only their own stake."}</span>
          <Link href="/dashboard/investors" className="flex shrink-0 items-center gap-1 font-medium hover:underline">
            <ArrowLeft size={12} /> Manage in ARC
          </Link>
        </div>
      )}

      <div className="mx-auto max-w-[560px] px-4 pb-28 pt-5 sm:pt-8">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-text)]">PROXe · Investor</p>
            <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-text sm:text-[28px]">
              {!data ? "\u00a0" : view === "home" ? (owner ? "PROXe, as investors see it" : `Hello, ${data.viewer.name.split(" ")[0]}.`) : TABS.find((t) => t.key === view)!.label}
            </h1>
            {data && <p className="mt-1 text-[12px] text-text-muted">Updated {fmtDateTime(data.generatedAt)}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {role === "investor" && (
              <button onClick={logout} aria-label="Sign out" className="rounded-pill bg-surface p-2.5 text-text-muted transition-colors hover:text-text">
                <LogOut size={16} />
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-panel bg-accent-red/[0.10] p-3">
            <p className="text-[12.5px] text-accent-red">{error}</p>
            <button onClick={load} className="shrink-0 rounded-pill bg-surface px-3 py-1.5 text-[12px] font-medium text-text">Try again</button>
          </div>
        )}
        {!data && loading && <Skeleton />}

        {/* ══ Updates, behind the bell ══ */}
        {data && view === "updates" && (
          <div className="space-y-4">
            <Card title="Everything that happened" icon={Newspaper} sub="newest first">
              <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-text-muted">
                <span className="flex items-center gap-1.5"><BadgeCheck size={11} className="text-accent-green" />Payments in</span>
                <span className="flex items-center gap-1.5"><Star size={11} className="fill-[#e8b931] text-[#e8b931]" />Links &amp; conversions</span>
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#c084fc]/50" />Marketing spend</span>
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-accent-blue/40" />Other spend</span>
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[var(--surface-hover)]" />Work in progress</span>
              </div>
              <Feed items={data.feed} />
            </Card>
          </div>
        )}

        {data && st && m && f && view === "home" && (
          <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
            {/* ══ Part 1: the investment. Terms of the company, not its activity. ══ */}
            <SectionHead title={owner ? "The round" : "Your investment"} sub={st.roundInfo ? `${st.roundInfo.name} · ${st.roundInfo.equityOffered}% for ${moneyShort(st.roundInfo.target)}` : undefined} />
            <section className="overflow-hidden rounded-panel bg-surface">
              <div className="bg-[var(--brand-faint)] p-4 sm:p-5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-text)]">
                  {owner ? "Equity issued so far" : "You own"}
                </p>
                <p className="mt-1 text-[34px] font-semibold leading-none tracking-tight tabular-nums text-text sm:text-[40px]">
                  {owner
                    ? (st.dilutedSoFar != null ? `${st.dilutedSoFar.toFixed(2)}%` : "–")
                    : (st.equityEarned != null ? `${st.equityEarned.toFixed(2)}%` : "–")}
                </p>
                <p className="mt-1.5 text-[12px] text-text-muted">
                  {owner ? "of PROXe, against money received" : `of PROXe, for the ${moneyShort(st.received ?? 0)} you sent${m.investedOn ? ` on ${fmtDate(m.investedOn)}` : ""}`}
                </p>
              </div>
              <dl className="px-4 sm:px-5">
                <div className="flex items-baseline justify-between gap-3 py-3">
                  <dt className="text-[12.5px] text-text-muted">Company worth <span className="text-[10.5px]">(post-money)</span></dt>
                  <dd className="text-[15px] font-semibold tabular-nums text-text">{st.valuation ? moneyShort(st.valuation) : "–"}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-3">
                  <dt className="text-[12.5px] text-text-muted">Company diluted so far</dt>
                  <dd className="text-[15px] font-semibold tabular-nums text-text">{st.dilutedSoFar != null ? `${st.dilutedSoFar.toFixed(2)}%` : "–"}</dd>
                </div>
                {st.roundInfo && (
                  <div className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[12.5px] text-text-muted">Round raised</dt>
                      <dd className="text-[15px] font-semibold tabular-nums text-text">
                        {moneyShort(st.roundInfo.raised)} <span className="text-[12px] font-normal text-text-muted">of {moneyShort(st.roundInfo.target)}</span>
                      </dd>
                    </div>
                    <div className="mt-2"><Bar value={st.roundInfo.target ? st.roundInfo.raised / st.roundInfo.target : 0} /></div>
                    <p className="mt-1.5 text-[11px] tabular-nums text-text-muted">
                      Day {st.roundInfo.daysOpen} · {st.roundInfo.daysLeft} days left · closes {fmtDate(st.roundInfo.closesOn)}
                    </p>
                  </div>
                )}
              </dl>
            </section>

            {/* The plan: what the round is for, and how far along it is */}
            <SectionHead title="The plan" sub="5,000 leads → 1,000 demos → 100 customers" />
            <section className="space-y-3 rounded-panel bg-surface p-4 sm:p-5">
              {[
                { label: "Leads", value: data.goal.leads, target: data.goal.targets.leads, bar: "bg-accent-blue", hint: "inbound + outbound reached" },
                { label: "Demos", value: data.goal.demos, target: data.goal.targets.demos, bar: "bg-[var(--brand)]", hint: "shown to prospects" },
                { label: "Customers", value: data.goal.conversions, target: data.goal.targets.conversions, bar: "bg-accent-green", hint: "paid" },
              ].map((g) => (
                <div key={g.label}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] font-medium text-text">{g.label} <span className="text-[10.5px] font-normal text-text-muted">{g.hint}</span></p>
                    <p className="text-[13px] tabular-nums text-text-muted">
                      <span className="text-[16px] font-semibold text-text">{g.value.toLocaleString("en-IN")}</span> / {g.target.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-pill bg-[var(--surface-hover)]">
                    <div className={`h-full rounded-pill ${g.bar}`} style={{ width: `${Math.max(1.5, Math.min(100, (g.value / g.target) * 100))}%` }} />
                  </div>
                  <p className="mt-1 text-right text-[10.5px] tabular-nums text-text-muted">{((g.value / g.target) * 100).toFixed(1)}% there</p>
                </div>
              ))}
            </section>

            {/* At a glance: the four numbers, then where to look next */}
            <SectionHead title="At a glance" sub={`PROXe, ${RANGE_LABEL[range]}`} />
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Sales", value: f.sales != null ? moneyShort(f.sales) : "–", tone: "text-accent-green", go: "money" as const },
                { label: "Spent", value: moneyShort(f.spentTotal), tone: "text-text", go: "money" as const },
                { label: "Demos done", value: String(f.demosDone), tone: "text-text", go: "growth" as const },
                { label: "Paying customers", value: String(f.activeSubs ?? "–"), tone: "text-accent-green", go: "growth" as const },
              ].map((x) => (
                <button key={x.label} onClick={() => go(x.go)} className="rounded-panel bg-surface p-4 text-left transition-colors active:bg-[var(--surface-hover)]">
                  <p className="text-[10.5px] uppercase tracking-[0.08em] text-text-muted">{x.label}</p>
                  <p className={`mt-1.5 text-[24px] font-semibold tabular-nums tracking-tight ${x.tone}`}>{x.value}</p>
                </button>
              ))}
            </div>

            {data.feed.length > 0 && (
              <Card title="Latest" icon={Newspaper} sub="from the updates">
                <Feed items={data.feed.slice(0, 3)} />
                <button onClick={openUpdates} className="mt-3 w-full rounded-card bg-[var(--surface-hover)] py-2.5 text-[12.5px] font-medium text-text">
                  See all updates
                </button>
              </Card>
            )}
          </div>
        )}

        {data && f && view === "growth" && (
          <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
            <div className="flex justify-end">
              <SegmentedTabs ariaLabel="Period" size="sm" value={range} onChange={setRange} tabs={RANGE_TABS} />
            </div>
            {/* Growth: the sequence a customer moves through */}
            <Card title="Growth" icon={Users} sub="lead to paying customer">
              <ol className="grid grid-cols-2 gap-2">
                {[
                  { icon: Inbox, label: "Incoming leads", value: f.incoming, hint: "inbound to PROXe", gold: false },
                  { icon: Radar, label: "Outbound touched", value: f.outbound, hint: `${f.outboundCalls} calls · ${f.outboundEmails} emails`, gold: false },
                  { icon: Presentation, label: "Demos done", value: f.demosDone, hint: "shown to prospects", gold: false },
                  { icon: Link2, label: "Links shared", value: f.linksShared, hint: "payment links sent", gold: true },
                ].map((x, i) => (
                  <li key={x.label} className={`relative rounded-card p-3 ${x.gold ? "bg-[#e8b931]/[0.10]" : "bg-[var(--surface-hover)]"}`}>
                    <div className="flex items-center gap-1.5 text-text-muted">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--bg)] text-[9.5px] font-semibold tabular-nums text-text">{i + 1}</span>
                      <x.icon size={12} className={x.gold ? "text-[#e8b931]" : ""} />
                    </div>
                    <p className={`mt-2 text-[24px] font-semibold tabular-nums ${x.gold ? "text-[#f0c84b]" : "text-text"}`}>{x.value ?? "–"}</p>
                    <p className="text-[12px] font-medium text-text">{x.label}</p>
                    <p className="text-[10.5px] text-text-muted">{x.hint}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-2 flex items-center gap-3 rounded-card bg-accent-green/[0.10] p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-green/15 text-accent-green">
                  <Repeat size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-text">Active subscriptions</p>
                  <p className="text-[10.5px] text-text-muted">customers paying every month, right now</p>
                </div>
                <p className="text-[24px] font-semibold tabular-nums text-accent-green">{f.activeSubs ?? "–"}</p>
              </div>
            </Card>
            {/* ══ Activity: demos booked and payment links, tracked over the window ══ */}
            <Card title="Activity" icon={Activity} sub={RANGE_LABEL[range]}>
              <div className="mb-4 grid grid-cols-2 gap-2">
                <div className="rounded-card bg-[var(--brand-faint)] p-3">
                  <p className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em] text-text-muted"><CalendarCheck size={11} />Demos booked</p>
                  <p className="mt-1 text-[24px] font-semibold tabular-nums text-text">{data.activity.demosBooked}</p>
                </div>
                <div className="rounded-card bg-[#e8b931]/[0.10] p-3">
                  <p className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em] text-text-muted"><Link2 size={11} />Payment links</p>
                  <p className="mt-1 text-[24px] font-semibold tabular-nums text-[#f0c84b]">{data.activity.linksShared}</p>
                </div>
              </div>
              <ActivityBars daily={data.activity.daily} />
              {data.activity.recent.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {data.activity.recent.map((r, i) => (
                    <li key={i} className={`flex items-center gap-3 rounded-card px-3 py-2 ${r.kind === "link" ? "bg-[#e8b931]/[0.08]" : "bg-[var(--surface-hover)]"}`}>
                      {r.kind === "link"
                        ? <Star size={12} className="shrink-0 fill-[#e8b931] text-[#e8b931]" />
                        : <CalendarCheck size={12} className="shrink-0 text-[var(--brand-text)]" />}
                      <span className={`min-w-0 flex-1 truncate text-[12.5px] ${r.kind === "link" ? "text-[#f0c84b]" : "text-text"}`}>{r.title}</span>
                      <span className="shrink-0 text-[10.5px] tabular-nums text-text-muted">{fmtDate(r.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            {/* ── Leads PROXe is handling ── */}
            <Card title="Leads PROXe is handling" icon={Users} sub="inbound, live from the product">
              {!data.leads && !data.traction ? (
                <p className="text-[12px] text-text-muted">Connecting to the PROXe product.</p>
              ) : (
                <div className="space-y-4">
                  {data.leads && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-card bg-accent-orange/[0.10] p-3">
                        <p className="text-[10.5px] uppercase tracking-[0.08em] text-text-muted">Warm leads</p>
                        <p className="mt-1 text-[24px] font-semibold tabular-nums text-text">{data.leads.warm}</p>
                        <p className="text-[10.5px] text-text-muted">score 40 to 79, open now</p>
                      </div>
                      <div className="rounded-card bg-accent-red/[0.10] p-3">
                        <p className="text-[10.5px] uppercase tracking-[0.08em] text-text-muted">Hot leads</p>
                        <p className="mt-1 text-[24px] font-semibold tabular-nums text-text">{data.leads.hot}</p>
                        <p className="text-[10.5px] text-text-muted">score 80+, ready to buy</p>
                      </div>
                    </div>
                  )}
                  {data.traction && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10.5px] uppercase tracking-[0.08em] text-text-muted">New leads</p>
                        <p className="mt-1 text-[22px] font-semibold tabular-nums text-text">{data.traction.leads}</p>
                        <p className="text-[11px] text-text-muted">{delta(data.traction.leads, data.traction.leadsPrev)}</p>
                      </div>
                      <div>
                        <p className="text-[10.5px] uppercase tracking-[0.08em] text-text-muted">In conversation</p>
                        <p className="mt-1 text-[22px] font-semibold tabular-nums text-text">{data.traction.conversations}</p>
                        <p className="text-[11px] text-text-muted">{data.traction.messages} replies sent by PROXe</p>
                      </div>
                    </div>
                  )}
                  {data.traction && data.traction.channels.length > 0 && (
                    <ul className="space-y-2">
                      {(() => {
                        const total = data.traction.channels.reduce((t, c) => t + c.touchpoints, 0) || 1;
                        return data.traction.channels.map((c) => (
                          <li key={c.channel}>
                            <div className="flex justify-between text-[12px]">
                              <span className="text-text">{CHANNEL_LABEL[c.channel] ?? c.channel}</span>
                              <span className="tabular-nums text-text-muted">{c.touchpoints} · {Math.round((c.touchpoints / total) * 100)}%</span>
                            </div>
                            <div className="mt-1"><Bar value={c.touchpoints / total} tone="blue" /></div>
                          </li>
                        ));
                      })()}
                    </ul>
                  )}
                  {data.leads && data.leads.stages.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {data.leads.stages.map((x) => (
                        <span key={x.stage} className="rounded-pill bg-[var(--surface-hover)] px-2.5 py-1 text-[11px] text-text-muted">
                          {x.stage} <span className="font-semibold tabular-nums text-text">{x.count}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}

        {data && view === "analytics" && (
          <div className={`transition-opacity ${loading ? "opacity-60" : ""}`}>
            {data.adsDesk.ok ? <AdsView d={data.adsDesk.data} /> : (
              <Card title="Analytics" icon={BarChart3} sub="from 4 Oct">
                <p className="text-[12px] text-text-muted">{data.adsDesk.reason}</p>
              </Card>
            )}
          </div>
        )}

        {data && m && f && view === "money" && (
          <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
            <div className="flex justify-end">
              <SegmentedTabs ariaLabel="Period" size="sm" value={range} onChange={setRange} tabs={RANGE_TABS} />
            </div>
            {/* Money: in, then out by department, then by kind */}
            <Card title="Money" icon={Wallet} sub={RANGE_LABEL[range]}>
              <MoneyLine
                label="Sales"
                hint={`${f.salesCount} payment${f.salesCount === 1 ? "" : "s"} received`}
                value={f.sales != null ? money(f.sales) : "–"}
                tone="in"
              />
              <p className="mb-1 mt-3 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-text-muted">Spends, by department</p>
              {f.spendGroups.length === 0 && <p className="py-2 text-[12px] text-text-muted">Nothing spent in this window.</p>}
              <div className="space-y-2">
                {f.spendGroups.map((g) => (
                  <div key={g.department} className={`rounded-card p-3 ${deptOf(g.department).box.replace(/border-\S+/g, "")}`}>
                    <div className="flex items-center justify-between gap-2">
                      <DeptChip name={g.department} />
                      <span className="text-[14px] font-semibold tabular-nums text-text">{money(g.total)}</span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {g.lines.map((l) => (
                        <li key={`${l.label}|${l.vendor}`} className="flex items-baseline justify-between gap-2 text-[12px]">
                          <span className="min-w-0 truncate text-text-muted"><span className="text-text">{l.vendor}</span> · {l.label}</span>
                          <span className="shrink-0 tabular-nums text-text">{money(l.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {f.spendByType.length > 0 && (
                <>
                  <p className="mb-1.5 mt-3 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-text-muted">By kind</p>
                  <div className="flex flex-wrap gap-1.5">
                    {f.spendByType.map((t) => (
                      <span key={t.label} className="rounded-pill bg-[var(--surface-hover)] px-2.5 py-1 text-[11.5px] text-text-muted">
                        {t.label} <span className="font-semibold tabular-nums text-text">{moneyShort(t.amount)}</span>
                      </span>
                    ))}
                  </div>
                </>
              )}
              <MoneyLine label="Total spends" value={money(f.spentTotal)} tone="total" />
              {sp && (
                <p className="mt-1.5 text-[10.5px] tabular-nums text-text-muted">
                  Burn {moneyShort(m.dailyBurn)}/day, averaged over {sp.burnDays} day{sp.burnDays === 1 ? "" : "s"} since {fmtDate(sp.since)}
                </p>
              )}
            </Card>
            {/* ── Every rupee: what, where it went, department, who approved ── */}
            <Card title="Every spend" icon={Wallet} sub={sp ? `since ${fmtDate(sp.since)}` : undefined}>
              {!data.spend.ok ? (
                <p className="text-[12px] text-text-muted">{data.spend.reason}</p>
              ) : sp && (
                <div className="space-y-4">
                  <SpendBars daily={sp.daily} />
                  <ul className="space-y-1.5">
                    {sp.ledger.map((e) => (
                      <li key={e.id} className="flex items-start justify-between gap-3 rounded-card bg-[var(--surface-hover)] p-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[12.5px] font-medium text-text">{e.vendor || CATEGORY_LABEL[e.category]}</p>
                            <DeptChip name={e.department || (e.category === "ad_topup" ? "Marketing" : "Operations")} />
                          </div>
                          {e.description && <p className="mt-0.5 break-words text-[11.5px] text-text-muted">{e.description}</p>}
                          <p className="mt-1 text-[10.5px] text-text-muted">
                            {fmtDate(e.spent_on)} · {CATEGORY_LABEL[e.category] ?? e.category}
                            {e.approved_by ? ` · approved by ${e.approved_by}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-text">{money(e.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* ══ The app's five doors ══ */}
      {data && (
        <nav className="fixed inset-x-0 bottom-0 z-20 bg-[var(--bg)]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
          <div className="mx-auto grid max-w-[560px] grid-cols-5 px-1 pt-1.5">
            {TABS.map((t) => {
              const on = view === t.key;
              return (
                <button key={t.key} onClick={() => (t.key === "updates" ? openUpdates() : go(t.key))}
                  className="relative flex flex-col items-center gap-1 rounded-card py-2" aria-current={on ? "page" : undefined}>
                  <span className={`flex h-8 w-12 items-center justify-center rounded-pill transition-colors ${on ? "bg-[var(--brand)] text-black" : "text-text-muted"}`}>
                    <t.icon size={18} />
                  </span>
                  <span className={`text-[10.5px] font-medium ${on ? "text-text" : "text-text-muted"}`}>{t.label}</span>
                  {t.key === "updates" && newCount > 0 && !on && (
                    <span className="absolute right-[22%] top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-pill bg-accent-red px-1 text-[9.5px] font-bold tabular-nums text-white">
                      {newCount > 9 ? "9+" : newCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
