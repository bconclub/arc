"use client";

import { TrendingUp, TrendingDown, Megaphone, MousePointerClick, PenLine, Globe } from "lucide-react";
import {
  getClarity,
  getMetaAds,
  getContentPulse,
  getMarketWatch,
  type Metric,
} from "@/lib/os-analytics";

const TAG_META: Record<string, { label: string; color: string; bg: string }> = {
  competitor:  { label: "Competitor",  color: "#ff4444", bg: "rgba(255,68,68,0.12)" },
  trend:       { label: "Trend",       color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  regulation:  { label: "Regulation",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  opportunity: { label: "Opportunity", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
};

function DeltaPill({ delta }: { delta?: number }) {
  if (delta === undefined) return null;
  const up = delta >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[11px] font-medium"
      style={{ color: up ? "var(--accent-green)" : "var(--accent-red)" }}
    >
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {Math.abs(delta)}%
    </span>
  );
}

function MetricCard({ m }: { m: Metric }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-text-muted">{m.label}</span>
        <DeltaPill delta={m.delta} />
      </div>
      <div className="text-[20px] font-semibold text-text leading-tight truncate">{m.value}</div>
      {m.hint && <div className="text-[10px] text-text-muted/60 mt-1">{m.hint}</div>}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  range,
}: {
  icon: React.ReactNode;
  title: string;
  range: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-8 first:mt-0">
      <span className="text-text-muted">{icon}</span>
      <h2 className="text-[14px] font-medium text-text">{title}</h2>
      <span className="text-[11px] text-text-muted/60">· {range}</span>
      <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-[var(--glow-white)] text-text-muted/70 border border-[var(--border)]">
        stub
      </span>
    </div>
  );
}

export default function PulsePage() {
  const content = getContentPulse();
  const ads = getMetaAds();
  const clarity = getClarity();
  const market = getMarketWatch();

  return (
    <div className="min-h-[calc(100vh-120px)] px-6 py-4 pb-24 max-w-5xl">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-xl font-semibold tracking-tight text-text">Pulse</h1>
        <p className="text-[13px] text-text-muted mt-0.5">
          the whole business in one view — content, ads, and site behaviour
        </p>
      </div>
      <p className="text-[11px] text-text-muted/60 mb-2">
        Showing placeholder data. Meta Ads + Microsoft Clarity connect at the integrations stage.
      </p>

      {/* Market watch — what the industry is doing */}
      <SectionHeader icon={<Globe size={15} />} title="What the market is doing" range="this week" />
      <div className="space-y-2">
        {market.items.map((item) => {
          const tag = TAG_META[item.tag];
          return (
            <div key={item.headline} className="card p-4">
              <div className="flex items-start gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md shrink-0 mt-0.5" style={{ color: tag.color, background: tag.bg }}>
                  {tag.label}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-medium text-text">{item.headline}</span>
                    <span className="text-[11px] text-text-muted/60">· {item.source}</span>
                  </div>
                  <p className="text-[12px] text-text-muted mt-1 leading-relaxed">
                    <span className="text-text-muted/60">so what: </span>{item.soWhat}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Content */}
      <SectionHeader icon={<PenLine size={15} />} title="Content" range="this week" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {content.metrics.map((m) => (
          <MetricCard key={m.label} m={m} />
        ))}
      </div>

      {/* Meta Ads */}
      <SectionHeader icon={<Megaphone size={15} />} title="Meta Ads" range={ads.range} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {ads.metrics.map((m) => (
          <MetricCard key={m.label} m={m} />
        ))}
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-text-muted/70 text-[11px] uppercase tracking-wide">
              <th className="text-left font-medium px-4 py-2.5">Campaign</th>
              <th className="text-right font-medium px-4 py-2.5">Spend</th>
              <th className="text-right font-medium px-4 py-2.5">Results</th>
              <th className="text-right font-medium px-4 py-2.5">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {ads.campaigns.map((c) => (
              <tr key={c.name} className="border-t border-[var(--border)]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: c.status === "active" ? "var(--accent-green)" : "var(--text-muted)" }}
                    />
                    <span className="text-text truncate">{c.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-text-muted tabular-nums">₹{c.spend.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 text-right text-text tabular-nums">
                  {c.results} <span className="text-text-muted/60 text-[11px]">{c.resultLabel}</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium" style={{ color: c.roas >= 2 ? "var(--accent-green)" : "var(--accent-orange)" }}>
                  {c.roas.toFixed(1)}x
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Clarity */}
      <SectionHeader icon={<MousePointerClick size={15} />} title="Site behaviour · Clarity" range={clarity.range} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {clarity.metrics.map((m) => (
          <MetricCard key={m.label} m={m} />
        ))}
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-text-muted/70 text-[11px] uppercase tracking-wide">
              <th className="text-left font-medium px-4 py-2.5">Page</th>
              <th className="text-right font-medium px-4 py-2.5">Sessions</th>
              <th className="text-right font-medium px-4 py-2.5">Scroll depth</th>
              <th className="text-right font-medium px-4 py-2.5">Dead clicks</th>
            </tr>
          </thead>
          <tbody>
            {clarity.topPages.map((p) => (
              <tr key={p.path} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 text-text font-mono text-[12px]">{p.path}</td>
                <td className="px-4 py-3 text-right text-text-muted tabular-nums">{p.sessions.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums" style={{ color: p.scrollDepth < 45 ? "var(--accent-orange)" : "var(--text-muted)" }}>
                  {p.scrollDepth}%
                </td>
                <td className="px-4 py-3 text-right tabular-nums" style={{ color: p.deadClicks > 70 ? "var(--accent-red)" : "var(--text-muted)" }}>
                  {p.deadClicks}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
