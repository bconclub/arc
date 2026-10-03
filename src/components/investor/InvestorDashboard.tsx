"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, LogOut, Loader2, Megaphone, CalendarCheck, Wallet, Rocket, PhoneCall,
  Newspaper, Pin, Target, CircleDollarSign, Presentation, PenLine,
} from "lucide-react";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { StatusPill } from "@/components/ui/StatusPill";
import { money, moneyShort } from "@/lib/format";
import type { DaySpend, FeedItem, InvestorOverview } from "@/lib/investor/data";

type Range = "7" | "30" | "90";

const CATEGORY_LABEL: Record<string, string> = {
  ads: "Ads (Meta)",
  ad_topup: "Ad wallet top-up",
  tools: "Tools & software",
  infra: "Infrastructure",
  calls: "Calling & telephony",
  people: "People",
  marketing: "Marketing (non-ads)",
  legal: "Legal & compliance",
  other: "Other",
};

const STAGE_LABEL: Record<string, string> = {
  identified: "Identified",
  researched: "Researched",
  drafted: "Drafted",
  sent: "Contacted",
  replied: "Replied",
  meeting: "Meeting",
  won: "Won",
};

const FEED_STAGE: Record<string, { label: string; tone: "info" | "warn" | "good" }> = {
  plan: { label: "Plan", tone: "info" },
  executing: { label: "In motion", tone: "warn" },
  done: { label: "Done", tone: "good" },
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function fmtDateTime(s: string) {
  return new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
function pct(n: number | null | undefined, digits = 1) {
  return n == null ? "–" : `${(n * 100).toFixed(digits)}%`;
}

function Card({ title, icon: Icon, sub, children, className = "" }: {
  title: string; icon: typeof Wallet; sub?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-panel border border-[var(--border)] bg-surface p-5 shadow-card ${className}`}>
      <header className="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <Icon size={14} className="shrink-0 translate-y-[2px] text-[var(--brand-text)]" />
        <h2 className="shrink-0 text-[13px] font-semibold text-text">{title}</h2>
        {sub && <span className="text-[11px] text-text-muted">{sub}</span>}
      </header>
      {children}
    </section>
  );
}

function Unavailable({ reason }: { reason: string }) {
  return <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-[12px] text-text-muted">{reason}</p>;
}

function Metric({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "warn" }) {
  const color = tone === "good" ? "text-accent-green" : tone === "warn" ? "text-accent-orange" : "text-text";
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-text-muted">{label}</p>
      <p className={`mt-1 text-[22px] font-semibold tabular-nums tracking-tight ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-text-muted">{hint}</p>}
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

/** Stacked daily bars: ad spend (lime) under everything else (blue). */
function SpendBars({ daily }: { daily: DaySpend[] }) {
  const max = Math.max(1, ...daily.map((d) => d.ads + d.other));
  const [hover, setHover] = useState<number | null>(null);
  const h = hover != null ? daily[hover] : null;
  return (
    <div>
      <div className="mb-2 flex h-5 items-center gap-3 text-[11px] text-text-muted">
        {h ? (
          <span className="tabular-nums text-text">
            {fmtDate(h.day)}: {money(h.ads + h.other)}
            <span className="text-text-muted"> · ads {money(h.ads)} · other {money(h.other)}{h.leads ? ` · ${h.leads} leads` : ""}</span>
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-[var(--brand)]" />Ads</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-accent-blue" />Everything else</span>
          </>
        )}
      </div>
      <div className="flex h-36 items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
        {daily.map((d, i) => {
          const total = d.ads + d.other;
          return (
            <div key={d.day} onMouseEnter={() => setHover(i)} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.day}: ${money(total)}`}>
              <div className="w-full rounded-t-[3px] bg-accent-blue opacity-80" style={{ height: `${(d.other / max) * 100}%` }} />
              <div
                className={`w-full bg-[var(--brand)] ${d.other ? "" : "rounded-t-[3px]"} ${hover === i ? "opacity-100" : "opacity-85"}`}
                style={{ height: `${(d.ads / max) * 100}%`, minHeight: total ? 2 : 0 }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-text-muted">
        <span>{daily[0] && fmtDate(daily[0].day)}</span>
        <span>{daily.length > 0 && fmtDate(daily[daily.length - 1].day)}</span>
      </div>
    </div>
  );
}

function FeedIcon({ item }: { item: FeedItem }) {
  const Icon =
    item.type === "money" ? CircleDollarSign
    : item.type === "demo" ? Presentation
    : item.kind === "ads" ? Megaphone
    : PenLine;
  const ring =
    item.stage === "plan" ? "border-accent-blue/50 text-accent-blue"
    : item.stage === "executing" ? "border-accent-orange/50 text-accent-orange"
    : "border-[var(--brand-line)] text-[var(--brand-text)]";
  return (
    <span className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-surface ${ring}`}>
      <Icon size={13} />
    </span>
  );
}

/** The investor feed: plan, execution and money, one timeline, newest first. */
function Feed({ items }: { items: FeedItem[] }) {
  if (!items.length) {
    return <p className="text-[12.5px] text-text-muted">Nothing posted yet. Plans, launches and money moved will appear here as they happen.</p>;
  }
  return (
    <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-[var(--border)]">
      {items.map((item) => {
        const stage = item.stage ? FEED_STAGE[item.stage] : null;
        return (
          <li key={item.id} className="flex gap-3">
            <FeedIcon item={item} />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="text-[13.5px] font-semibold leading-snug text-text">{item.title}</h3>
                {stage && <StatusPill status={stage.label} tone={stage.tone} />}
                {item.pinned && <Pin size={11} className="text-[var(--brand-text)]" aria-label="Pinned" />}
              </div>
              <p className="mt-0.5 text-[10.5px] tabular-nums text-text-muted">{fmtDateTime(item.at)}</p>
              {item.body && <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-relaxed text-text-muted">{item.body}</p>}
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
                      <p className="mb-1 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-text-muted">
                        <Target size={11} /> Targeting
                      </p>
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

export function InvestorDashboard({ role }: { role: "owner" | "investor" }) {
  const [range, setRange] = useState<Range>("30");
  const [data, setData] = useState<InvestorOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/investor/overview?days=${range}`);
    if (res.status === 401) { window.location.href = "/investor/login"; return; }
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !json) { setError("The overview did not load. Try again in a minute."); return; }
    setData(json);
  }, [range]);

  useEffect(() => { load(); }, [load]);

  async function logout() {
    await fetch("/api/investor/logout", { method: "POST" });
    window.location.href = "/investor/login";
  }

  const m = data?.money;
  const st = data?.stake;
  const w = data?.adWallet;
  const owner = data?.viewer.role === "owner";

  return (
    <div className="min-h-screen bg-bg">
      {role === "owner" && (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--brand-line)] bg-[var(--brand-faint)] px-4 py-2 text-[12px] text-[var(--brand-text)] sm:px-8">
          <span>Preview: this page is exactly what investors see. Each investor sees their own stake here.</span>
          <Link href="/dashboard/investors" className="flex shrink-0 items-center gap-1 font-medium hover:underline">
            <ArrowLeft size={12} /> Manage in ARC
          </Link>
        </div>
      )}

      <div className="mx-auto max-w-dashboard px-4 py-6 sm:px-8 sm:py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-text)]">PROXe · Investor feed</p>
            <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-text sm:text-[28px]">
              {!data ? "Loading…" : owner ? "PROXe, as investors see it" : `Hello, ${data.viewer.name.split(" ")[0]}.`}
            </h1>
            {data && (
              <p className="mt-1 text-[12.5px] text-text-muted">
                What was planned, what was done, and where the money went · updated {fmtDateTime(data.generatedAt)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SegmentedTabs
              ariaLabel="Period"
              size="sm"
              value={range}
              onChange={setRange}
              tabs={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]}
            />
            {role === "investor" && (
              <button onClick={logout} aria-label="Sign out" className="rounded-pill border border-[var(--border)] p-2 text-text-muted transition-colors hover:text-text">
                <LogOut size={14} />
              </button>
            )}
          </div>
        </header>

        {error && <p className="mb-4 text-[12.5px] text-accent-red">{error}</p>}
        {loading && !data && (
          <div className="flex items-center gap-2 py-24 text-[12.5px] text-text-muted"><Loader2 size={14} className="animate-spin" /> Pulling live numbers…</div>
        )}

        {data && st && m && (
          <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
            {/* ── Stake: this investor's slice of the round ── */}
            <Card
              title={owner ? "The round" : "Your stake"}
              icon={Wallet}
              sub={[
                st.round,
                st.equityPct != null && st.promised ? `${st.equityPct}% for ${moneyShort(st.promised)}` : null,
                st.valuation ? `${moneyShort(st.valuation)} post-money` : null,
                m.investedOn ? `since ${fmtDate(m.investedOn)}` : null,
              ].filter(Boolean).join(" · ") || undefined}
            >
              <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
                <Metric
                  label={owner ? "Promised" : "You promised"}
                  value={st.promised != null ? moneyShort(st.promised) : "Not set"}
                  hint={owner ? `${st.investors} investor${st.investors === 1 ? "" : "s"}` : undefined}
                />
                <Metric
                  label="Received"
                  value={st.received != null ? moneyShort(st.received) : "–"}
                  hint={st.promised && st.received != null ? `${pct(st.received / st.promised, 0)} of promise` : undefined}
                />
                <Metric
                  label={st.equityPct != null ? "Equity earned" : owner ? "Round size" : "Your share"}
                  value={
                    st.equityEarned != null ? `${st.equityEarned.toFixed(2)}%`
                    : owner ? moneyShort(st.roundPromised) : pct(st.shareOfRound)
                  }
                  hint={st.equityPct != null ? `of ${st.equityPct}% on full ${moneyShort(st.promised ?? 0)}` : !owner ? `of ${moneyShort(st.roundPromised)} round` : undefined}
                />
                <Metric
                  label={owner ? "Deployed" : "Your money deployed"}
                  value={moneyShort(owner ? m.deployed : (st.yourDeployed ?? 0))}
                  hint={`ads ${moneyShort(m.deployedAds)} · other ${moneyShort(m.deployedOther)}`}
                />
                <Metric
                  label="Daily burn"
                  value={moneyShort(m.dailyBurn)}
                  hint={m.runwayLeft != null && m.dailyBurn > 0 ? `≈ ${Math.max(0, Math.floor(m.runwayLeft / m.dailyBurn))} days at this pace` : `average over ${data.range.days} days`}
                />
              </div>
              {st.roundDeployedPct != null && (
                <div className="mt-5">
                  <Bar value={st.roundDeployedPct} />
                  <p className="mt-1.5 text-[11px] tabular-nums text-text-muted">
                    {owner ? "" : "Your money at work: "}{moneyShort(m.deployed)} of {moneyShort(st.roundReceived || st.roundPromised)} received is deployed ({pct(st.roundDeployedPct)})
                  </p>
                </div>
              )}
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* ── The feed ── */}
              <Card title="Feed" icon={Newspaper} sub="plan → execute, newest first" className="lg:col-span-2">
                <Feed items={data.feed} />
              </Card>

              {/* ── Right rail ── */}
              <div className="space-y-4">
                {w && (
                  <Card title="Ad wallet" icon={Megaphone} sub={`funded since ${fmtDate(w.firstTopup)}`}>
                    <div className="grid grid-cols-2 gap-5">
                      <Metric label="Funded" value={money(w.funded)} />
                      <Metric label="Left" value={money(w.balance)} tone={w.daysLeft != null && w.daysLeft <= 3 ? "warn" : undefined} />
                      <Metric label="Spent" value={money(w.spent)} hint={w.estimated ? "estimated from budget" : undefined} />
                      <Metric
                        label="Daily budget"
                        value={w.dailyBudget ? money(w.dailyBudget) : "–"}
                        hint={w.daysLeft != null ? `≈ ${w.daysLeft} day${w.daysLeft === 1 ? "" : "s"} of ads left` : undefined}
                      />
                    </div>
                    <div className="mt-4">
                      <Bar value={w.funded ? w.spent / w.funded : 0} />
                    </div>
                  </Card>
                )}

                <Card title="Demos" icon={CalendarCheck} sub={`last ${data.range.days} days`}>
                  {!data.demos.ok ? <Unavailable reason={data.demos.reason} /> : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <Metric label="Booked" value={String(data.demos.data.inRange)} />
                        <Metric label="Shown" value={String(data.demos.data.done)} tone="good" />
                        <Metric label="No-show" value={String(data.demos.data.noShow)} />
                      </div>
                      {data.demos.data.upcoming.length > 0 && (
                        <ul className="space-y-1">
                          {data.demos.data.upcoming.map((d) => (
                            <li key={d.id} className="flex justify-between gap-2 text-[12px]">
                              <span className="truncate text-text">{d.company}</span>
                              <span className="shrink-0 tabular-nums text-text-muted">{fmtDateTime(d.scheduled_at)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </Card>

                <Card title="Sales pipeline" icon={PhoneCall} sub="outbound, real businesses only">
                  {!data.pipeline.ok ? <Unavailable reason={data.pipeline.reason} /> : (
                    <ul className="space-y-1.5">
                      {(() => {
                        const stages = data.pipeline.ok ? data.pipeline.data.stages : [];
                        const max = Math.max(1, ...stages.map((s) => s.count));
                        return stages.map((s) => (
                          <li key={s.stage} className="grid grid-cols-[84px_1fr_36px] items-center gap-2 text-[12px]">
                            <span className="text-text-muted">{STAGE_LABEL[s.stage] ?? s.stage}</span>
                            <Bar value={s.count / max} tone="blue" />
                            <span className="text-right tabular-nums text-text">{s.count}</span>
                          </li>
                        ));
                      })()}
                    </ul>
                  )}
                </Card>
              </div>
            </div>

            {/* ── Spend detail ── */}
            <Card title="Spend" icon={Wallet} sub={`last ${data.range.days} days`}>
              {!data.spend.ok ? <Unavailable reason={data.spend.reason} /> : (
                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <div className="mb-4 flex flex-wrap gap-6">
                      <Metric label="Total" value={money(data.spend.data.total)} />
                      <Metric label="Ads" value={money(data.spend.data.ads)} />
                      <Metric label="Everything else" value={money(data.spend.data.other)} />
                    </div>
                    <SpendBars daily={data.spend.data.daily} />
                  </div>
                  <div>
                    <p className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-text-muted">Line items</p>
                    {data.spend.data.ledger.length === 0 ? (
                      <p className="text-[12px] text-text-muted">No spend recorded in this period.</p>
                    ) : (
                      <ul className="space-y-2">
                        {data.spend.data.ledger.map((e) => (
                          <li key={e.id} className="flex justify-between gap-3 text-[12px]">
                            <span className="min-w-0">
                              <span className="block truncate text-text">{[e.vendor, e.description].filter(Boolean).join(" · ") || CATEGORY_LABEL[e.category]}</span>
                              <span className="text-[10.5px] text-text-muted">{fmtDate(e.spent_on)} · {CATEGORY_LABEL[e.category] ?? e.category}</span>
                            </span>
                            <span className="shrink-0 tabular-nums text-text">{money(e.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </Card>

            {/* ── Ads running ── */}
            <Card title="Ads running now" icon={Megaphone} sub="Meta, last 30 days per ad">
              {!data.ads.ok ? <Unavailable reason={data.ads.reason} /> : data.ads.data.running.length === 0 ? (
                <p className="text-[12px] text-text-muted">No ads are live right now.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {data.ads.data.running.map((ad) => (
                    <article key={ad.id} className="overflow-hidden rounded-card border border-[var(--border)] bg-[var(--surface-hover)]">
                      {ad.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ad.thumbnail} alt="" className="aspect-[1.91/1] w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex aspect-[1.91/1] items-center justify-center text-[11px] text-text-muted">No preview</div>
                      )}
                      <div className="space-y-1.5 p-3">
                        <p className="line-clamp-1 text-[12.5px] font-medium text-text">{ad.headline || ad.name}</p>
                        {ad.body && <p className="line-clamp-2 text-[11.5px] text-text-muted">{ad.body}</p>}
                        <div className="flex gap-4 pt-1 text-[11px] tabular-nums">
                          <span className="text-text">{money(ad.spend)}</span>
                          <span className="text-text-muted">{ad.leads} leads</span>
                          <span className="text-text-muted">{ad.leads ? `${money(ad.spend / ad.leads)}/lead` : `${ad.clicks} clicks`}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Product" icon={Rocket} sub={data.product.ok ? `${data.product.data.commitsInRange} changes shipped` : undefined}>
                {!data.product.ok || data.product.data.shipped.length === 0 ? (
                  <p className="text-[12px] text-text-muted">No code shipped in this period.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.product.data.shipped.slice(0, 7).map((c, i) => (
                      <li key={i} className="text-[12px]">
                        <p className="line-clamp-1 text-text">{c.message}</p>
                        <p className="text-[10.5px] text-text-muted">{c.repo} · {fmtDate(c.date)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Where PROXe stands" icon={Rocket} sub="go-to-market, area by area">
                {!data.product.ok || data.product.data.stage.length === 0 ? (
                  <Unavailable reason="No go-to-market areas recorded yet." />
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {data.product.data.stage.map((s) => (
                      <li key={s.title} className="py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12.5px] font-medium text-text">{s.title}</span>
                          <StatusPill status={s.status.replace("_", " ")} />
                        </div>
                        {s.stand && <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-text-muted" title={s.stand}>{s.stand}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
