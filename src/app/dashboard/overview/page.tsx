"use client";

import { useMemo } from "react";
import { Briefcase, Camera, AtSign, DollarSign, MessageCircle } from "lucide-react";
import { MetricCard } from "@/components/overview/MetricCard";
import { SummaryBar } from "@/components/overview/SummaryBar";
import { WeeklyLog } from "@/components/overview/WeeklyLog";
import { AIButton } from "@/components/ai/AIButton";
import { AIPanel } from "@/components/ai/AIPanel";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useAI } from "@/hooks/useAI";
import {
  defaultLinkedIn,
  defaultInstagram,
  defaultTwitter,
  defaultSalesPipeline,
  defaultWhatsApp,
} from "@/lib/defaults";
import type { ChannelMetrics, MetricHistory, WeeklyLogEntry } from "@/types/overview";

function buildSparkline(history: MetricHistory[], channel: string, metricKey: string): number[] {
  const relevant = history
    .filter((h) => h.channel === channel && h.key === metricKey)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-7);

  if (relevant.length === 0) return [];

  const points: number[] = [];
  relevant.forEach((h) => {
    points.push(parseFloat(h.newValue.replace(/[^0-9.-]/g, "")) || 0);
  });
  return points;
}

export default function OverviewPage() {
  const [linkedin, setLinkedin] = useLocalStorage<ChannelMetrics>("koex:linkedin", defaultLinkedIn);
  const [instagram, setInstagram] = useLocalStorage<ChannelMetrics>("koex:instagram", defaultInstagram);
  const [twitter, setTwitter] = useLocalStorage<ChannelMetrics>("koex:twitter", defaultTwitter);
  const [sales, setSales] = useLocalStorage<ChannelMetrics>("koex:sales", defaultSalesPipeline);
  const [whatsapp, setWhatsapp] = useLocalStorage<ChannelMetrics>("koex:whatsapp", defaultWhatsApp);
  const [history, setHistory] = useLocalStorage<MetricHistory[]>("koex:metric-history", []);
  const [logEntries, setLogEntries] = useLocalStorage<WeeklyLogEntry[]>("koex:weekly-log", []);

  const sparklines = useMemo(
    () => ({
      linkedin: buildSparkline(history, "linkedin", "impressions"),
      instagram: buildSparkline(history, "instagram", "reach"),
      twitter: buildSparkline(history, "twitter", "impressions"),
      whatsapp: buildSparkline(history, "whatsapp", "messagesSent"),
      sales: buildSparkline(history, "sales", "demosBooked"),
    }),
    [history]
  );

  const handleSave = (setter: (val: ChannelMetrics) => void) => {
    return (updated: ChannelMetrics, newHistory: MetricHistory[]) => {
      setter(updated);
      if (newHistory.length > 0) {
        setHistory((prev) => [...prev, ...newHistory]);
      }
    };
  };

  const handleAddLog = (entry: WeeklyLogEntry) => {
    setLogEntries((prev) => [...prev, entry]);
  };

  const analysisAI = useAI<string>();

  const runAnalysis = async () => {
    await analysisAI.trigger(
      "analyze-metrics",
      {
        metrics: { linkedin, instagram, twitter, sales, whatsapp },
        history: history.slice(-30),
        logEntries: logEntries.slice(-15),
      },
      true
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tighter">Overview</h1>
        <AIButton onClick={runAnalysis} loading={analysisAI.loading} label="AI Analysis" />
      </div>

      {(analysisAI.streamText || analysisAI.error) && (
        <AIPanel
          title="Metrics Analysis"
          content={analysisAI.streamText}
          streaming={analysisAI.streaming}
          error={analysisAI.error}
          onClose={analysisAI.reset}
        />
      )}

      <SummaryBar linkedin={linkedin} instagram={instagram} twitter={twitter} sales={sales} />

      <div>
        <p className="section-heading mb-5 mt-2">Channels</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <MetricCard
            title="LinkedIn"
            icon={<Briefcase size={17} />}
            metrics={linkedin}
            onSave={handleSave(setLinkedin)}
            storageKey="linkedin"
            sparklineData={sparklines.linkedin}
          />
          <MetricCard
            title="Instagram"
            icon={<Camera size={17} />}
            metrics={instagram}
            onSave={handleSave(setInstagram)}
            storageKey="instagram"
            sparklineData={sparklines.instagram}
          />
          <MetricCard
            title="Twitter / X"
            icon={<AtSign size={17} />}
            metrics={twitter}
            onSave={handleSave(setTwitter)}
            storageKey="twitter"
            sparklineData={sparklines.twitter}
          />
        </div>
      </div>

      <div>
        <p className="section-heading mb-5">Pipeline</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <MetricCard
            title="Sales Pipeline"
            icon={<DollarSign size={17} />}
            metrics={sales}
            onSave={handleSave(setSales)}
            storageKey="sales"
            sparklineData={sparklines.sales}
          />
          <MetricCard
            title="WhatsApp Outreach"
            icon={<MessageCircle size={17} />}
            metrics={whatsapp}
            onSave={handleSave(setWhatsapp)}
            storageKey="whatsapp"
            sparklineData={sparklines.whatsapp}
          />
        </div>
      </div>

      <div>
        <p className="section-heading mb-5">Activity</p>
        <WeeklyLog entries={logEntries} onAdd={handleAddLog} />
      </div>
    </div>
  );
}
