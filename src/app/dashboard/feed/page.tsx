"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, PenLine, FileText, Sparkles, Loader2 } from "lucide-react";
import { useAI } from "@/hooks/useAI";
import { supabase, type Signal } from "@/lib/supabase";
import type { Source, TrendLabel, Pillar } from "@/types/signals";
import { calculateTrendScore, detectPillar, getTrendBadge } from "@/types/signals";

interface SignalWithMeta extends Signal {
  extracting?: boolean;
}

const PILLAR_PLACEHOLDERS: Record<Pillar, string> = {
  pain_points: "#3d1a1a",
  build_journey: "#1a1a3d",
  marketing_tips: "#1a3d2a",
  client_results: "#3d2e1a",
};

export default function FeedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [signals, setSignals] = useState<SignalWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingRSS, setFetchingRSS] = useState(false);
  const extractAI = useAI<{ signal: Signal; fullContent: string }>();

  const fetchAllSignals = useCallback(async () => {
    setLoading(true);
    
    const { data: sources, error } = await supabase
      .from("sources")
      .select("*")
      .eq("active", true);
    
    if (error) {
      console.error("Error fetching sources:", error);
      setLoading(false);
      return;
    }

    const allSignals: SignalWithMeta[] = [];

    for (const source of (sources || [])) {
      if (source.type === "rss") {
        try {
          setFetchingRSS(true);
          const res = await fetch(`/api/fetch-rss?url=${encodeURIComponent(source.value)}`);
          if (res.ok) {
            const data = await res.json();
            const rssSignals = data.data.map((item: {
              title: string;
              link: string;
              snippet: string;
              pubDate: string;
              image: string;
            }, index: number) => {
              const { score, label } = calculateTrendScore(item.title, item.snippet, item.pubDate);
              const pillar = detectPillar(item.title, item.snippet);
              
              return {
                id: `rss-${source.id}-${index}`,
                title: item.title,
                url: item.link,
                snippet: item.snippet,
                source_name: source.name,
                image_url: item.image || undefined,
                published_date: item.pubDate,
                pillar,
                trend_score: score,
                label,
                saved: false,
                created_at: new Date().toISOString(),
              };
            });
            allSignals.push(...rssSignals);
          }
        } catch (err) {
          console.error(`Error fetching RSS from ${source.name}:`, err);
        }
        setFetchingRSS(false);
      } else if (source.type === "tavily_search") {
        try {
          const res = await fetch("/api/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "fetch-signals", payload: {} }),
          });
          
          if (res.ok) {
            const data = await res.json();
            if (data.data) {
              allSignals.push(...data.data.map((s: Signal) => ({
                ...s,
                id: s.id || `sig-${Date.now()}`,
              })));
            }
          }
        } catch (err) {
          console.error("Error fetching Tavily signals:", err);
        }
      }
    }

    allSignals.sort((a, b) => b.trend_score - a.trend_score);
    setSignals(allSignals);
    setLoading(false);
  }, []);

  useEffect(() => {
    const shouldRefresh = searchParams.get("refresh") === "true";
    if (shouldRefresh) {
      router.replace("/dashboard/feed");
    }
    fetchAllSignals();
  }, [fetchAllSignals, searchParams, router]);

  const handleWrite = (signal: Signal) => {
    const params = new URLSearchParams({
      topic: signal.title,
      snippet: signal.snippet,
      url: signal.url,
    });
    router.push(`/dashboard/write?${params.toString()}`);
  };

  const handleGoDeeper = async (signal: SignalWithMeta, index: number) => {
    setSignals(prev => prev.map((s, i) => i === index ? { ...s, extracting: true } : s));
    
    await extractAI.trigger("extract-and-save", {
      url: signal.url,
      title: signal.title,
      snippet: signal.snippet,
      image_url: signal.image_url,
      source_name: signal.source_name,
      trend_score: signal.trend_score,
      label: signal.label,
    }, false);
  };

  useEffect(() => {
    if (extractAI.data?.signal && extractAI.data?.fullContent) {
      const params = new URLSearchParams({
        topic: extractAI.data.signal.title,
        context: extractAI.data.fullContent,
        url: extractAI.data.signal.url,
        deep: "true",
      });
      router.push(`/dashboard/write?${params.toString()}`);
    }
  }, [extractAI.data, router]);

  return (
    <div className="min-h-[calc(100vh-120px)] pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Feed</h1>
          <p className="text-[12px] text-text-muted">
            {fetchingRSS && "Fetching RSS..."}
            {!fetchingRSS && `${signals.length} signals`}
          </p>
        </div>
        <button
          onClick={fetchAllSignals}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-text-muted hover:text-text bg-surface hover:bg-surface-hover rounded-full transition-all"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {loading && signals.length === 0 ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="tile animate-pulse">
              <div className="thumb bg-white/[0.06]" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-white/[0.06] rounded w-full" />
                <div className="h-3 bg-white/[0.06] rounded w-3/4" />
                <div className="h-2 bg-white/[0.04] rounded w-20" />
              </div>
            </div>
          ))
        ) : signals.length === 0 ? (
          <div className="col-span-full card p-8 text-center">
            <Sparkles size={32} className="mx-auto mb-4 text-text-muted/30" />
            <p className="text-sm text-text-muted mb-1">No signals yet</p>
            <button
              onClick={() => router.push("/dashboard/sources")}
              className="px-4 py-2 text-[12px] font-medium bg-white text-black rounded-lg hover:bg-white/90"
            >
              Manage Sources
            </button>
          </div>
        ) : (
          signals.map((signal, index) => {
            const badge = getTrendBadge(signal.label as TrendLabel, signal.trend_score);
            const isHot = signal.label === "hot";
            const pillar = signal.pillar as Pillar;
            const placeholderColor = pillar ? PILLAR_PLACEHOLDERS[pillar] : "#1a1a1a";

            return (
              <div
                key={signal.id}
                className={`tile group ${isHot ? "feed-tile-hot" : ""}`}
                style={isHot ? { animationDelay: `${(index % 4) * 0.5}s` } : {}}
              >
                {/* Thumbnail - 16:9 */}
                <div className="thumb">
                  {signal.image_url ? (
                    <img
                      src={signal.image_url}
                      alt=""
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div 
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ backgroundColor: placeholderColor }}
                    >
                      <span className="text-[10px] text-white/30 uppercase tracking-wider">
                        {signal.source_name}
                      </span>
                    </div>
                  )}
                  
                  {/* Score badge - top left */}
                  <div 
                    className="badge"
                    style={{ 
                      color: badge.color, 
                      backgroundColor: badge.bg,
                    }}
                  >
                    <span>{badge.icon}</span>
                    <span>{badge.text}</span>
                  </div>

                  {/* Hover actions */}
                  <div className="hover-actions">
                    <button
                      onClick={() => handleWrite(signal)}
                      className="flex items-center gap-2 px-4 py-2 bg-white text-black text-[13px] font-medium rounded-full hover:bg-white/90 transition-all"
                    >
                      <PenLine size={14} />
                      Write this
                    </button>
                  </div>

                  {/* Go deeper - bottom right */}
                  <button
                    onClick={() => handleGoDeeper(signal, index)}
                    disabled={signal.extracting}
                    className="absolute bottom-2 right-2 p-2 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-black/80 disabled:opacity-50"
                  >
                    {signal.extracting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <FileText size={14} />
                    )}
                  </button>
                </div>

                {/* Info */}
                <div className="info">
                  <p className="title">{signal.title}</p>
                  <p className="meta">
                    {signal.source_name} · {new Date(signal.published_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
