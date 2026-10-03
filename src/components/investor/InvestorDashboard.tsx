"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, LogOut, Loader2, Megaphone, Wallet, Newspaper, Pin, Target,
  Users, Code2, Handshake, Settings2, Star, BadgeCheck, Bell, X, ChevronRight, Inbox, Radar, Presentation, Link2, Repeat,
} from "lucide-react";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { StatusPill } from "@/components/ui/StatusPill";
import { money, moneyShort } from "@/lib/format";
import type { DaySpend, FeedItem, InvestorOverview } from "@/lib/investor/data";

type Range = "7" | "30" | "3650";

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
    <section className={`min-w-0 rounded-panel border border-[var(--border)] bg-surface p-4 shadow-card sm:p-5 ${className}`}>
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
    <div className={`flex items-baseline justify-between gap-3 py-2.5 ${tone === "total" ? "border-t border-[var(--border-strong)]" : ""}`}>
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
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-pill border px-2 py-0.5 text-[10.5px] font-semibold ${d.chip}`}>
      <d.icon size={11} /> {name || d.label}
    </span>
  );
}

/** Demos per day: booked (light) behind taken (green). Tap a day for its numbers. */
function DemoBars({ daily: days }: { daily: { day: string; booked: number; done: number }[] }) {
  // Past six weeks of days the bars get too thin on a phone: show weeks instead.
  const daily = days.length <= 45 ? days : days.reduce<{ day: string; booked: number; done: number }[]>((out, d, i) => {
    if (i % 7 === 0) out.push({ day: d.day, booked: 0, done: 0 });
    const w = out[out.length - 1]!;
    w.booked += d.booked;
    w.done += d.done;
    return out;
  }, []);
  const max = Math.max(1, ...daily.map((d) => d.booked));
  const [hover, setHover] = useState<number | null>(null);
  const h = hover != null ? daily[hover] : null;
  return (
    <div>
      <div className="mb-2 flex min-h-5 flex-wrap items-center gap-3 text-[11px] text-text-muted">
        {h ? (
          <span className="tabular-nums text-text">{fmtDate(h.day)}: {h.done} taken of {h.booked} booked</span>
        ) : (
          <>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-accent-green" />Taken</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-[var(--surface-hover)] ring-1 ring-[var(--border-strong)]" />Booked</span>
          </>
        )}
      </div>
      <div className="flex h-32 items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
        {daily.map((d, i) => (
          <div key={d.day} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}
            className="relative flex h-full min-w-[6px] flex-1 flex-col justify-end" title={`${d.day}: ${d.done}/${d.booked}`}>
            <div className="absolute bottom-0 w-full rounded-t-[3px] bg-[var(--surface-hover)] ring-1 ring-inset ring-[var(--border)]"
              style={{ height: `${(d.booked / max) * 100}%` }} />
            <div className="relative w-full rounded-t-[3px] bg-accent-green"
              style={{ height: `${(d.done / max) * 100}%`, minHeight: d.done ? 3 : 0 }} />
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
            <div className={`min-w-0 flex-1 rounded-card border p-3 ${box}`}>
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
                <div className="mt-2.5 space-y-2 rounded-card border border-[var(--border)] bg-[var(--surface-hover)] p-3">
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

export function InvestorDashboard({ role, viewAs = null }: { role: "owner" | "investor"; viewAs?: string | null }) {
  const [range, setRange] = useState<Range>("30");
  const [data, setData] = useState<InvestorOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/investor/overview?days=${range}${viewAs ? `&as=${viewAs}` : ""}`);
    if (res.status === 401) { window.location.href = "/investor/login"; return; }
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !json) { setError("The overview did not load. Try again in a minute."); return; }
    setData(json);
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

  return (
    <div className="min-h-screen overflow-x-hidden bg-bg">
      {role === "owner" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--brand-line)] bg-[var(--brand-faint)] px-4 py-2 text-[12px] text-[var(--brand-text)] sm:px-8">
          <span>{viewAs && data ? `Viewing as ${data.viewer.name}: exactly their screen.` : "Preview: exactly what investors see. Each sees only their own stake."}</span>
          <Link href="/dashboard/investors" className="flex shrink-0 items-center gap-1 font-medium hover:underline">
            <ArrowLeft size={12} /> Manage in ARC
          </Link>
        </div>
      )}

      <div className="mx-auto max-w-dashboard px-4 py-5 sm:px-8 sm:py-8">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-text)]">PROXe · Investor feed</p>
            <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-text sm:text-[28px]">
              {!data ? "Loading…" : owner ? "PROXe, as investors see it" : `Hello, ${data.viewer.name.split(" ")[0]}.`}
            </h1>
            {data && <p className="mt-1 text-[12px] text-text-muted">Updated {fmtDateTime(data.generatedAt)}</p>}
          </div>
          {role === "investor" && (
            <button onClick={logout} aria-label="Sign out" className="rounded-pill border border-[var(--border)] p-2 text-text-muted transition-colors hover:text-text">
              <LogOut size={14} />
            </button>
          )}
        </header>

        {error && <p className="mb-4 text-[12.5px] text-accent-red">{error}</p>}
        {loading && !data && (
          <div className="flex items-center gap-2 py-24 text-[12.5px] text-text-muted"><Loader2 size={14} className="animate-spin" /> Pulling live numbers…</div>
        )}

        {data && st && m && (
          <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
            {/* ── What is new since the last visit ── */}
            {fresh.length > 0 && (
              <div className="flex items-start gap-3 rounded-panel border border-[var(--brand-line)] bg-[var(--brand-faint)] p-3 sm:p-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-black">
                  <Bell size={13} />
                </span>
                <a href="#feed" className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-text">
                    {fresh.length === 1 ? "1 new update" : `${fresh.length} new updates`}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {fresh.slice(0, 3).map((f) => (
                      <li key={f.id} className={`truncate text-[12px] ${f.tone === "paid" ? "text-accent-green" : f.tone === "sales" ? "text-[#f0c84b]" : "text-text-muted"}`}>
                        {f.title}
                      </li>
                    ))}
                    {fresh.length > 3 && <li className="text-[11.5px] text-text-muted">and {fresh.length - 3} more in the feed</li>}
                  </ul>
                </a>
                <button onClick={markSeen} aria-label="Mark as seen" className="shrink-0 rounded-pill p-1.5 text-text-muted hover:text-text">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* ══ Part 1: the investment. Terms of the company, not its activity. ══ */}
            <SectionHead title={owner ? "The round" : "Your investment"} sub={st.roundInfo ? `${st.roundInfo.name} · ${st.roundInfo.equityOffered}% for ${moneyShort(st.roundInfo.target)}` : undefined} />
            <section className="overflow-hidden rounded-panel border border-[var(--brand-line)] bg-surface">
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
              <dl className="divide-y divide-[var(--border)] px-4 sm:px-5">
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

            {/* ══ Part 2: the business. What PROXe did with the time and money. ══ */}
            <SectionHead title="The business" sub={`PROXe, ${RANGE_LABEL[range]}`}>
              <SegmentedTabs ariaLabel="Period" size="sm" value={range} onChange={setRange} tabs={RANGE_TABS} />
            </SectionHead>

            <div className="grid gap-4 lg:grid-cols-5">
              {/* Growth: the sequence a customer moves through */}
              <Card title="Growth" icon={Users} sub="lead to paying customer" className="lg:col-span-3">
                <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { icon: Inbox, label: "Incoming leads", value: data.funnel.incoming, hint: "inbound to PROXe", gold: false },
                    { icon: Radar, label: "Outbound leads", value: data.funnel.outbound, hint: "prospects scraped", gold: false },
                    { icon: Presentation, label: "Demos done", value: data.funnel.demosDone, hint: "shown to prospects", gold: false },
                    { icon: Link2, label: "Links shared", value: data.funnel.linksShared, hint: "payment links sent", gold: true },
                  ].map((s, i) => (
                    <li key={s.label} className={`relative rounded-card border p-3 ${s.gold ? "border-[#e8b931]/45 bg-[#e8b931]/[0.08]" : "border-[var(--border)] bg-[var(--surface-hover)]"}`}>
                      <div className="flex items-center gap-1.5 text-text-muted">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--border)] text-[9.5px] font-semibold tabular-nums text-text">{i + 1}</span>
                        <s.icon size={12} className={s.gold ? "text-[#e8b931]" : ""} />
                      </div>
                      <p className={`mt-2 text-[24px] font-semibold tabular-nums ${s.gold ? "text-[#f0c84b]" : "text-text"}`}>{s.value ?? "–"}</p>
                      <p className="text-[12px] font-medium text-text">{s.label}</p>
                      <p className="text-[10.5px] text-text-muted">{s.hint}</p>
                      {i < 3 && <ChevronRight size={14} className="absolute -right-[11px] top-1/2 z-[1] hidden -translate-y-1/2 text-text-muted sm:block" />}
                    </li>
                  ))}
                </ol>
                <div className="mt-3 flex items-center gap-3 rounded-card border border-accent-green/45 bg-accent-green/[0.08] p-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent-green/50 text-accent-green">
                    <Repeat size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-text">Active subscriptions</p>
                    <p className="text-[10.5px] text-text-muted">customers paying every month, right now</p>
                  </div>
                  <p className="text-[24px] font-semibold tabular-nums text-accent-green">{data.funnel.activeSubs ?? "–"}</p>
                </div>
              </Card>

              {/* Money: in, then out, split by who spent it */}
              <Card title="Money" icon={Wallet} sub={RANGE_LABEL[range]} className="lg:col-span-2">
                <MoneyLine
                  label="Total sales"
                  hint={`${data.funnel.salesCount} payment${data.funnel.salesCount === 1 ? "" : "s"} received`}
                  value={data.funnel.sales != null ? money(data.funnel.sales) : "–"}
                  tone="in"
                />
                <MoneyLine label="Marketing spend" hint="ads, creative" value={money(data.funnel.spentMarketing)} dept="Marketing" />
                <MoneyLine label="Company spends" hint="engineering, tools, operations" value={money(data.funnel.spentCompany)} />
                <MoneyLine label="Total spends" value={money(data.funnel.spentMarketing + data.funnel.spentCompany)} tone="total" />
                {sp && (
                  <p className="mt-1 text-[10.5px] tabular-nums text-text-muted">
                    Burn {moneyShort(m.dailyBurn)}/day, averaged over {sp.burnDays} day{sp.burnDays === 1 ? "" : "s"} since {fmtDate(sp.since)}
                  </p>
                )}
              </Card>
            </div>

            {/* ══ Part 3: the detail ══ */}
            <SectionHead title="What's happening" sub="every move, newest first" />

            <div className="grid gap-4 lg:grid-cols-3">
              {/* ── What is happening ── */}<span id="feed" className="sr-only" />
              <Card title="Feed" icon={Newspaper} sub="plans, launches, money moved" className="lg:col-span-2">
                <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-text-muted">
                  <span className="flex items-center gap-1.5"><BadgeCheck size={11} className="text-accent-green" />Payments in</span>
                  <span className="flex items-center gap-1.5"><Star size={11} className="fill-[#e8b931] text-[#e8b931]" />Links &amp; conversions</span>
                  <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm border border-[#c084fc]/60 bg-[#c084fc]/25" />Marketing spend</span>
                  <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm border border-accent-blue/50 bg-accent-blue/20" />Other spend</span>
                  <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm border border-[var(--border)] bg-[var(--surface-hover)]" />Work in progress</span>
                </div>
                <Feed items={data.feed} />
              </Card>

              {/* ── Leads PROXe is handling ── */}
              <Card title="Leads PROXe is handling" icon={Users} sub="inbound, live from the product">
                {!data.leads && !data.traction ? (
                  <p className="text-[12px] text-text-muted">Connecting to the PROXe product.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-end">
                      <SegmentedTabs ariaLabel="Period" size="sm" value={range} onChange={setRange} tabs={RANGE_TABS} />
                    </div>
                    {data.leads && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-card border border-accent-orange/40 bg-accent-orange/[0.08] p-3">
                          <p className="text-[10.5px] uppercase tracking-[0.08em] text-text-muted">Warm leads</p>
                          <p className="mt-1 text-[24px] font-semibold tabular-nums text-text">{data.leads.warm}</p>
                          <p className="text-[10.5px] text-text-muted">score 40 to 79, open now</p>
                        </div>
                        <div className="rounded-card border border-accent-red/40 bg-accent-red/[0.08] p-3">
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
                          const total = data.traction.channels.reduce((s, c) => s + c.touchpoints, 0) || 1;
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
                        {data.leads.stages.map((s) => (
                          <span key={s.stage} className="rounded-pill border border-[var(--border)] px-2 py-0.5 text-[11px] text-text-muted">
                            {s.stage} <span className="tabular-nums text-text">{s.count}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {data.leads && data.leads.recent.length > 0 && (
                      <ul className="divide-y divide-[var(--border)]">
                        {data.leads.recent.map((l, i) => (
                          <li key={i} className="flex items-center gap-3 py-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[10.5px] font-semibold text-text-muted">{l.initials}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12px] text-text">{l.stage ?? "New"}</span>
                              <span className="text-[10.5px] text-text-muted">{CHANNEL_LABEL[l.channel ?? ""] ?? l.channel ?? "–"} · {fmtDate(l.at)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </Card>
            </div>

            {/* ── Demos, day by day ── */}
            {data.demos.ok && (
              <Card title="Demos" icon={Users} sub={`last ${data.range.days} days`}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-6">
                    <div>
                      <p className="text-[10.5px] uppercase tracking-[0.08em] text-text-muted">Booked</p>
                      <p className="mt-1 text-[22px] font-semibold tabular-nums text-text">{data.demos.data.inRange}</p>
                    </div>
                    <div>
                      <p className="text-[10.5px] uppercase tracking-[0.08em] text-text-muted">Taken</p>
                      <p className="mt-1 text-[22px] font-semibold tabular-nums text-accent-green">{data.demos.data.done}</p>
                    </div>
                    <div>
                      <p className="text-[10.5px] uppercase tracking-[0.08em] text-text-muted">No-show</p>
                      <p className="mt-1 text-[22px] font-semibold tabular-nums text-text">{data.demos.data.noShow}</p>
                    </div>
                  </div>
                  <SegmentedTabs ariaLabel="Demo period" size="sm" value={range} onChange={setRange} tabs={RANGE_TABS} />
                </div>
                <DemoBars daily={data.demos.data.daily} />
              </Card>
            )}

            {/* ── Where the money went ── */}
            <Card title="Where the money went" icon={Wallet} sub={sp ? `since ${fmtDate(sp.since)}` : undefined}>
              {!data.spend.ok ? (
                <p className="text-[12px] text-text-muted">{data.spend.reason}</p>
              ) : sp && (
                <div className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <p className="text-[10.5px] uppercase tracking-[0.08em] text-text-muted">Total spent</p>
                      <p className="mt-1 text-[26px] font-semibold tabular-nums tracking-tight text-text">{money(sp.total)}</p>
                      <div className="mt-3"><SpendBars daily={sp.daily} /></div>
                    </div>
                    <div>
                      <p className="mb-2 text-[10.5px] uppercase tracking-[0.08em] text-text-muted">By department</p>
                      <ul className="space-y-2">
                        {sp.byDepartment.map((d) => (
                          <li key={d.department}>
                            <div className="flex justify-between text-[12px]">
                              <DeptChip name={d.department} />
                              <span className="tabular-nums text-text-muted">{money(d.amount)} · {sp.total ? Math.round((d.amount / sp.total) * 100) : 0}%</span>
                            </div>
                            <div className="mt-1.5 h-2 overflow-hidden rounded-pill bg-[var(--surface-hover)]">
                              <div className={`h-full rounded-pill ${deptOf(d.department).bar}`} style={{ width: `${sp.total ? (d.amount / sp.total) * 100 : 0}%` }} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Every rupee: what, where it went, department, who approved. */}
                  <div>
                    <p className="mb-2 text-[10.5px] uppercase tracking-[0.08em] text-text-muted">Every spend</p>
                    <ul className="divide-y divide-[var(--border)] rounded-card border border-[var(--border)]">
                      {sp.ledger.map((e) => (
                        <li key={e.id} className="flex items-start justify-between gap-3 p-3">
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
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
