"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LogOut, Loader2, Megaphone, CalendarCheck, Wallet, Rocket, PhoneCall, Newspaper } from "lucide-react";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { StatusPill } from "@/components/ui/StatusPill";
import { money, moneyShort } from "@/lib/format";
import type { DaySpend, InvestorOverview } from "@/lib/investor/data";

type Range = "7" | "30" | "90";

const CATEGORY_LABEL: Record<string, string> = {
  ads: "Ads (Meta)",
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

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function fmtDateTime(s: string) {
  return new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
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
    <div>
      <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-text-muted">{label}</p>
      <p className={`mt-1 text-[22px] font-semibold tabular-nums tracking-tight ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-text-muted">{hint}</p>}
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
      <div className="flex h-40 items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
        {daily.map((d, i) => {
          const total = d.ads + d.other;
          return (
            <div
              key={d.day}
              onMouseEnter={() => setHover(i)}
              className="flex h-full min-w-0 flex-1 cursor-default flex-col justify-end"
              title={`${d.day}: ${money(total)}`}
            >
              <div
                className={`w-full rounded-t-[3px] bg-accent-blue ${hover === i ? "opacity-100" : "opacity-80"}`}
                style={{ height: `${(d.other / max) * 100}%` }}
              />
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
  const deployedPct = useMemo(() => {
    if (!m?.committed) return null;
    return Math.min(100, (m.deployed / m.committed) * 100);
  }, [m]);

  return (
    <div className="min-h-screen bg-bg">
      {role === "owner" && (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--brand-line)] bg-[var(--brand-faint)] px-4 py-2 text-[12px] text-[var(--brand-text)] sm:px-8">
          <span>Preview: this page is exactly what investors see.</span>
          <Link href="/dashboard/investors" className="flex items-center gap-1 font-medium hover:underline">
            <ArrowLeft size={12} /> Manage in ARC
          </Link>
        </div>
      )}

      <div className="mx-auto max-w-dashboard px-4 py-6 sm:px-8 sm:py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-text)]">PROXe · Investor view</p>
            <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-text sm:text-[28px]">
              {!data ? "Loading…" : data.viewer.role === "owner" ? "PROXe, as investors see it" : `Hello, ${data.viewer.name.split(" ")[0]}.`}
            </h1>
            {data && (
              <p className="mt-1 text-[12.5px] text-text-muted">
                {fmtDate(data.range.since)} to {fmtDate(data.range.until)} · updated {fmtDateTime(data.generatedAt)}
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
              <button
                onClick={logout}
                aria-label="Sign out"
                className="rounded-pill border border-[var(--border)] p-2 text-text-muted transition-colors hover:text-text"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        </header>

        {error && <p className="mb-4 text-[12.5px] text-accent-red">{error}</p>}
        {loading && !data && (
          <div className="flex items-center gap-2 py-24 text-[12.5px] text-text-muted"><Loader2 size={14} className="animate-spin" /> Pulling live numbers…</div>
        )}

        {data && (
          <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
            {/* ── The money ── */}
            <Card title="Your money" icon={Wallet} sub={m?.investedOn ? `since ${fmtDate(m.investedOn)}` : undefined}>
              <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                <Metric label="Committed" value={m?.committed != null ? moneyShort(m.committed) : "Not set"} />
                <Metric
                  label="Deployed"
                  value={moneyShort(m?.deployed ?? 0)}
                  hint={`ads ${moneyShort(m?.deployedAds ?? 0)} · other ${moneyShort(m?.deployedOther ?? 0)}`}
                />
                <Metric
                  label="Remaining"
                  value={m?.runwayLeft != null ? moneyShort(m.runwayLeft) : "–"}
                  tone={m?.runwayLeft != null && m.runwayLeft < 0 ? "warn" : undefined}
                />
                <Metric
                  label="Daily burn"
                  value={moneyShort(m?.dailyBurn ?? 0)}
                  hint={
                    m?.runwayLeft != null && m.dailyBurn > 0
                      ? `≈ ${Math.max(0, Math.floor(m.runwayLeft / m.dailyBurn))} days at this pace`
                      : `average over ${data.range.days} days`
                  }
                />
              </div>
              {deployedPct != null && (
                <div className="mt-5">
                  <div className="h-2 overflow-hidden rounded-pill bg-[var(--surface-hover)]">
                    <div className="h-full rounded-pill bg-[var(--brand)]" style={{ width: `${deployedPct}%` }} />
                  </div>
                  <p className="mt-1.5 text-[11px] tabular-nums text-text-muted">{deployedPct.toFixed(1)}% of committed capital deployed</p>
                </div>
              )}
            </Card>

            {/* ── Spend ── */}
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
                    <p className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-text-muted">By category</p>
                    {data.spend.data.byCategory.length === 0 ? (
                      <p className="text-[12px] text-text-muted">No spend recorded in this period.</p>
                    ) : (
                      <ul className="space-y-2">
                        {data.spend.data.byCategory.map((c) => {
                          const pct = data.spend.ok && data.spend.data.total ? (c.amount / data.spend.data.total) * 100 : 0;
                          return (
                            <li key={c.category}>
                              <div className="flex justify-between text-[12px]">
                                <span className="text-text">{CATEGORY_LABEL[c.category] ?? c.category}</span>
                                <span className="tabular-nums text-text-muted">{money(c.amount)}</span>
                              </div>
                              <div className="mt-1 h-1 rounded-pill bg-[var(--surface-hover)]">
                                <div
                                  className={`h-full rounded-pill ${c.category === "ads" ? "bg-[var(--brand)]" : "bg-accent-blue"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {data.spend.data.ledger.length > 0 && (
                    <div className="overflow-x-auto lg:col-span-3">
                      <table className="w-full min-w-[520px] text-[12px]">
                        <thead>
                          <tr className="text-left text-[10px] uppercase tracking-wider text-text-muted">
                            <th className="py-2 pr-4 font-semibold">Date</th>
                            <th className="py-2 pr-4 font-semibold">Category</th>
                            <th className="py-2 pr-4 font-semibold">What</th>
                            <th className="py-2 text-right font-semibold">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.spend.data.ledger.map((e) => (
                            <tr key={e.id} className="border-t border-[var(--border)]">
                              <td className="py-2 pr-4 tabular-nums text-text-muted">{fmtDate(e.spent_on)}</td>
                              <td className="py-2 pr-4 text-text-muted">{CATEGORY_LABEL[e.category] ?? e.category}</td>
                              <td className="py-2 pr-4 text-text">{[e.vendor, e.description].filter(Boolean).join(" · ") || "–"}</td>
                              <td className="py-2 text-right tabular-nums text-text">{money(e.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* ── Demos ── */}
              <Card title="Demos" icon={CalendarCheck} sub={`last ${data.range.days} days`}>
                {!data.demos.ok ? <Unavailable reason={data.demos.reason} /> : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <Metric label="Booked" value={String(data.demos.data.inRange)} />
                      <Metric label="Shown" value={String(data.demos.data.done)} tone="good" />
                      <Metric label="No-show" value={String(data.demos.data.noShow)} />
                    </div>
                    {data.demos.data.weekly.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-[10.5px] uppercase tracking-[0.08em] text-text-muted">Per week</p>
                        <div className="flex h-14 items-end gap-1">
                          {data.demos.data.weekly.map((w) => {
                            const max = Math.max(1, ...data.demos.ok ? data.demos.data.weekly.map((x) => x.count) : [1]);
                            return (
                              <div key={w.week} className="flex-1" title={`Week of ${fmtDate(w.week)}: ${w.count}`}>
                                <div className="rounded-t-[3px] bg-accent-green/80" style={{ height: `${(w.count / max) * 56}px` }} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {data.demos.data.upcoming.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-[10.5px] uppercase tracking-[0.08em] text-text-muted">Coming up</p>
                        <ul className="space-y-1">
                          {data.demos.data.upcoming.map((d) => (
                            <li key={d.id} className="flex justify-between gap-2 text-[12px]">
                              <span className="truncate text-text">{d.company}</span>
                              <span className="shrink-0 tabular-nums text-text-muted">{fmtDateTime(d.scheduled_at)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.demos.data.recent.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-[10.5px] uppercase tracking-[0.08em] text-text-muted">Recent</p>
                        <ul className="space-y-1.5">
                          {data.demos.data.recent.slice(0, 6).map((d) => (
                            <li key={d.id} className="flex items-center justify-between gap-2 text-[12px]">
                              <span className="truncate text-text">{d.company}</span>
                              <StatusPill status={d.outcome ?? d.status} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.demos.data.inRange === 0 && data.demos.data.upcoming.length === 0 && (
                      <p className="text-[12px] text-text-muted">No demos in this period.</p>
                    )}
                  </div>
                )}
              </Card>

              {/* ── Pipeline ── */}
              <Card title="Sales pipeline" icon={PhoneCall} sub="outbound, real businesses only">
                {!data.pipeline.ok ? <Unavailable reason={data.pipeline.reason} /> : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <Metric label="Calls" value={String(data.pipeline.data.callsInRange)} hint={`last ${data.range.days}d`} />
                      <Metric label="Connected" value={String(data.pipeline.data.connectedInRange)} />
                      <Metric label="Interested" value={String(data.pipeline.data.interestedInRange)} tone="good" />
                    </div>
                    <ul className="space-y-1.5">
                      {(() => {
                        const stages = data.pipeline.ok ? data.pipeline.data.stages : [];
                        const max = Math.max(1, ...stages.map((s) => s.count));
                        return stages.map((s) => (
                          <li key={s.stage} className="grid grid-cols-[88px_1fr_36px] items-center gap-2 text-[12px]">
                            <span className="text-text-muted">{STAGE_LABEL[s.stage] ?? s.stage}</span>
                            <div className="h-2 rounded-pill bg-[var(--surface-hover)]">
                              <div className="h-full rounded-pill bg-accent-blue/80" style={{ width: `${(s.count / max) * 100}%` }} />
                            </div>
                            <span className="text-right tabular-nums text-text">{s.count}</span>
                          </li>
                        ));
                      })()}
                    </ul>
                  </div>
                )}
              </Card>

              {/* ── Product ── */}
              <Card title="Product" icon={Rocket} sub={data.product.ok ? `${data.product.data.commitsInRange} changes shipped` : undefined}>
                {!data.product.ok ? <Unavailable reason={data.product.reason} /> : (
                  <div className="space-y-4">
                    {data.product.data.shipped.length > 0 ? (
                      <ul className="space-y-2">
                        {data.product.data.shipped.slice(0, 7).map((c, i) => (
                          <li key={i} className="text-[12px]">
                            <p className="line-clamp-1 text-text">{c.message}</p>
                            <p className="text-[10.5px] text-text-muted">{c.repo} · {fmtDate(c.date)}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[12px] text-text-muted">No code shipped in this period.</p>
                    )}
                  </div>
                )}
              </Card>
            </div>

            {/* ── Ads ── */}
            <Card title="Ads running now" icon={Megaphone} sub="Meta, last 30 days per ad">
              {!data.ads.ok ? <Unavailable reason={data.ads.reason} /> : (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-6">
                    <Metric label="Spend 30d" value={money(data.ads.data.spend30)} />
                    <Metric label="Leads 30d" value={String(data.ads.data.leads30)} />
                    <Metric label="Cost per lead" value={data.ads.data.cpl30 != null ? money(data.ads.data.cpl30) : "–"} />
                    <Metric
                      label="Click-through"
                      value={data.ads.data.impressions30 ? `${((data.ads.data.clicks30 / data.ads.data.impressions30) * 100).toFixed(2)}%` : "–"}
                      hint={`${data.ads.data.impressions30.toLocaleString("en-IN")} impressions`}
                    />
                  </div>
                  {data.ads.data.running.length === 0 ? (
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
                            <p className="text-[10.5px] text-text-muted">{ad.campaign}</p>
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
                </div>
              )}
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* ── Where we stand ── */}
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
                        {s.stand && <p className="mt-1 line-clamp-4 text-[11.5px] leading-relaxed text-text-muted" title={s.stand}>{s.stand}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* ── Updates ── */}
              <Card title="Updates from the founder" icon={Newspaper}>
                {data.updates.length === 0 ? (
                  <p className="text-[12px] text-text-muted">No updates posted yet.</p>
                ) : (
                  <ul className="space-y-5">
                    {data.updates.map((u) => (
                      <li key={u.id}>
                        <div className="flex items-baseline gap-2">
                          <h3 className="text-[13px] font-semibold text-text">{u.title}</h3>
                          <span className="text-[10.5px] tabular-nums text-text-muted">{fmtDate(u.published_at)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-text-muted">{u.body_md}</p>
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
