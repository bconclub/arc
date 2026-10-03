"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, LogOut, Loader2, Megaphone, Wallet, Newspaper, Pin, Target,
  Users, Building2, PieChart, ReceiptIndianRupee, Code2, Handshake, Settings2, Star,
} from "lucide-react";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { StatusPill } from "@/components/ui/StatusPill";
import { money, moneyShort } from "@/lib/format";
import type { DaySpend, FeedItem, InvestorOverview } from "@/lib/investor/data";

type Range = "7" | "30" | "90";

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

/** One headline number. The four of these are the whole story at a glance. */
function Tile({ icon: Icon, label, value, hint, accent }: {
  icon: typeof Wallet; label: string; value: string; hint?: string; accent?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-panel border p-4 sm:p-5 ${accent ? "border-[var(--brand-line)] bg-[var(--brand-faint)]" : "border-[var(--border)] bg-surface"}`}>
      <p className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-text-muted">
        <Icon size={12} className="shrink-0" /> <span className="truncate">{label}</span>
      </p>
      <p className="mt-2 text-[22px] font-semibold tabular-nums tracking-tight text-text sm:text-[26px]">{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-snug text-text-muted">{hint}</p>}
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
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-[var(--brand)]" />Ads</span>
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
              <div className={`w-full bg-[var(--brand)] ${d.other ? "" : "rounded-t-[3px]"}`} style={{ height: `${(d.ads / max) * 100}%`, minHeight: total ? 2 : 0 }} />
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
const DEPT: Record<string, { icon: typeof Wallet; label: string }> = {
  Marketing: { icon: Megaphone, label: "Marketing" },
  Sales: { icon: Handshake, label: "Sales" },
  Engineering: { icon: Code2, label: "Engineering" },
  Operations: { icon: Settings2, label: "Operations" },
};

function FeedIcon({ item }: { item: FeedItem }) {
  const Icon = (DEPT[item.department] ?? DEPT.Operations).icon;
  const ring =
    item.tone === "sales" ? "border-[#e8b931]/60 text-[#e8b931]"
    : item.tone === "spend" ? "border-accent-blue/50 text-accent-blue"
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
          item.tone === "sales"
            ? "border-[#e8b931]/45 bg-[#e8b931]/[0.08]"
            : item.tone === "spend"
              ? "border-accent-blue/30 bg-accent-blue/[0.06]"
              : "border-[var(--border)] bg-[var(--surface-hover)]";
        return (
          <li key={item.id} className="flex gap-3">
            <FeedIcon item={item} />
            <div className={`min-w-0 flex-1 rounded-card border p-3 ${box}`}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {item.tone === "sales" && <Star size={13} className="shrink-0 fill-[#e8b931] text-[#e8b931]" aria-label="Conversion" />}
                <h3 className={`text-[13.5px] font-semibold leading-snug ${item.tone === "sales" ? "text-[#f0c84b]" : "text-text"}`}>{item.title}</h3>
                {stage && <StatusPill status={stage.label} tone={stage.tone} />}
                <span className="rounded-pill border border-[var(--border)] px-1.5 py-px text-[10px] text-text-muted">{item.department}</span>
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
            {/* ── The four numbers that matter ── */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile
                icon={Building2}
                label="Company worth"
                value={st.valuation ? moneyShort(st.valuation) : "–"}
                hint={st.valuation ? `${st.round ?? "Current round"}, post-money` : "Set once the round terms are entered"}
                accent
              />
              <Tile
                icon={PieChart}
                label="Diluted so far"
                value={st.dilutedSoFar != null ? `${st.dilutedSoFar.toFixed(2)}%` : "–"}
                hint={
                  !owner && st.equityEarned != null
                    ? `Yours: ${st.equityEarned.toFixed(2)}% of ${st.equityPct}% (${moneyShort(st.received ?? 0)} of ${moneyShort(st.promised ?? 0)} in)`
                    : "Equity issued against money received"
                }
              />
              <Tile
                icon={ReceiptIndianRupee}
                label="Sales total"
                value={data.sales ? money(data.sales.total) : "–"}
                hint={data.sales ? `${data.sales.payments} payment${data.sales.payments === 1 ? "" : "s"}${data.sales.last ? ` · last ${fmtDate(data.sales.last)}` : ""}` : "Connecting to checkout"}
              />
              <Tile
                icon={Wallet}
                label="Total spent"
                value={money(m.deployed)}
                hint={sp ? `${moneyShort(m.dailyBurn)}/day over ${sp.burnDays} day${sp.burnDays === 1 ? "" : "s"} since ${fmtDate(sp.since)}` : undefined}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* ── What is happening ── */}
              <Card title="What's happening" icon={Newspaper} sub="newest first" className="lg:col-span-2">
                <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-text-muted">
                  <span className="flex items-center gap-1.5"><Star size={11} className="fill-[#e8b931] text-[#e8b931]" />Sales &amp; conversions</span>
                  <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm border border-accent-blue/50 bg-accent-blue/20" />Money spent</span>
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
                      <SegmentedTabs ariaLabel="Period" size="sm" value={range} onChange={setRange}
                        tabs={[{ value: "7", label: "7d" }, { value: "30", label: "30d" }, { value: "90", label: "90d" }]} />
                    </div>
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
                              <span className="text-text">{d.department}</span>
                              <span className="tabular-nums text-text-muted">{money(d.amount)} · {sp.total ? Math.round((d.amount / sp.total) * 100) : 0}%</span>
                            </div>
                            <div className="mt-1"><Bar value={sp.total ? d.amount / sp.total : 0} /></div>
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
                            <p className="text-[12.5px] font-medium text-text">{e.vendor || CATEGORY_LABEL[e.category]}</p>
                            {e.description && <p className="mt-0.5 break-words text-[11.5px] text-text-muted">{e.description}</p>}
                            <p className="mt-1 text-[10.5px] text-text-muted">
                              {fmtDate(e.spent_on)} · {CATEGORY_LABEL[e.category] ?? e.category}
                              {e.department ? ` · ${e.department}` : ""}
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
