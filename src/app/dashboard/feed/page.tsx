"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, PenLine, FileText, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { supabase, type Signal } from "@/lib/supabase";
import type { TrendLabel, Pillar } from "@/types/signals";
import { getTrendBadge } from "@/types/signals";

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
  const [signals, setSignals] = useState<SignalWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Track mount to prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch signals on mount
  useEffect(() => {
    if (!mounted) return;
    
    const fetchData = async () => {
      await fetchAllSignals();
    };
    
    fetchData();
  }, [mounted]);

  const fetchAllSignals = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Check if Supabase is configured
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        throw new Error("Supabase URL not configured");
      }

      const { data: sources, error: sourcesError } = await supabase
        .from("sources")
        .select("*")
        .eq("active", true);
      
      if (sourcesError) {
        throw new Error(`Supabase error: ${sourcesError.message}`);
      }

      const allSignals: SignalWithMeta[] = [];

      // Only fetch RSS if we have sources
      if (sources && sources.length > 0) {
        for (const source of sources) {
          if (source.type === "rss" && source.value) {
            try {
              const res = await fetch(`/api/fetch-rss?url=${encodeURIComponent(source.value)}`);
              if (res.ok) {
                const data = await res.json();
                if (data.data && Array.isArray(data.data)) {
                  const rssSignals = data.data.map((item: {
                    title: string;
                    link: string;
                    snippet: string;
                    pubDate: string;
                    image: string;
                  }, index: number) => ({
                    id: `rss-${source.id}-${index}`,
                    title: item.title || "Untitled",
                    url: item.link || "",
                    snippet: item.snippet || "",
                    source_name: source.name,
                    image_url: item.image || undefined,
                    published_date: item.pubDate || new Date().toISOString(),
                    pillar: "build_journey" as Pillar,
                    trend_score: 50,
                    label: "steady" as TrendLabel,
                    saved: false,
                    created_at: new Date().toISOString(),
                  }));
                  allSignals.push(...rssSignals);
                }
              }
            } catch (err) {
              console.error(`RSS fetch error for ${source.name}:`, err);
              // Continue with other sources
            }
          }
        }
      }

      allSignals.sort((a, b) => b.trend_score - a.trend_score);
      setSignals(allSignals);
    } catch (err) {
      console.error("Feed fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load feed");
    } finally {
      setLoading(false);
    }
  };

  const handleWrite = (signal: Signal) => {
    if (!signal) return;
    const params = new URLSearchParams({
      topic: signal.title || "",
      snippet: signal.snippet || "",
      url: signal.url || "",
    });
    router.push(`/dashboard/write?${params.toString()}`);
  };

  const handleGoDeeper = async (signal: SignalWithMeta) => {
    if (!signal?.url) return;
    
    setSignals(prev => 
      prev.map(s => s.id === signal.id ? { ...s, extracting: true } : s)
    );

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extract-and-save",
          payload: {
            url: signal.url,
            title: signal.title,
            snippet: signal.snippet,
            image_url: signal.image_url,
            source_name: signal.source_name,
            trend_score: signal.trend_score,
            label: signal.label,
          },
        }),
      });

      if (!res.ok) throw new Error("Extract failed");
      
      const data = await res.json();
      if (data.data?.fullContent) {
        const params = new URLSearchParams({
          topic: signal.title,
          context: data.data.fullContent,
          url: signal.url,
          deep: "true",
        });
        router.push(`/dashboard/write?${params.toString()}`);
      }
    } catch (err) {
      console.error("Go deeper error:", err);
      alert("Failed to extract content. Please try again.");
      setSignals(prev => 
        prev.map(s => s.id === signal.id ? { ...s, extracting: false } : s)
      );
    }
  };

  // Prevent hydration mismatch - render minimal UI until mounted
  if (!mounted) {
    return (
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-120px)] pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Feed</h1>
          <p className="text-[12px] text-text-muted">
            {loading ? "Loading..." : `${signals?.length || 0} signals`}
          </p>
        </div>
        <button
          onClick={fetchAllSignals}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-text-muted hover:text-text bg-surface hover:bg-surface-hover rounded-full transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="card p-4 mb-4 border-accent-red/30">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-accent-red shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] text-text mb-1">Error loading feed</p>
              <p className="text-[12px] text-text-muted">{error}</p>
              <button
                onClick={fetchAllSignals}
                className="mt-2 text-[12px] text-accent-green hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="tile animate-pulse">
              <div className="thumb bg-white/[0.06]" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-white/[0.06] rounded w-full" />
                <div className="h-3 bg-white/[0.06] rounded w-3/4" />
                <div className="h-2 bg-white/[0.04] rounded w-20" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && (!signals || signals.length === 0) && (
        <div className="card p-8 text-center">
          <Sparkles size={32} className="mx-auto mb-4 text-text-muted/30" />
          <p className="text-sm text-text-muted mb-1">No signals yet</p>
          <p className="text-xs text-text-muted/60 mb-4">
            {process.env.NEXT_PUBLIC_SUPABASE_URL 
              ? "Tap refresh to fetch from your sources"
              : "Supabase not configured. Check environment variables."
            }
          </p>
          {process.env.NEXT_PUBLIC_SUPABASE_URL && (
            <button
              onClick={fetchAllSignals}
              className="px-4 py-2 text-[12px] font-medium bg-white text-black rounded-lg hover:bg-white/90"
            >
              Fetch Now
            </button>
          )}
        </div>
      )}

      {/* Signals Grid */}
      {!loading && !error && signals && signals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {signals.map((signal, index) => {
            if (!signal) return null;
            
            const badge = getTrendBadge(signal.label as TrendLabel, signal.trend_score);
            const isHot = signal.label === "hot";
            const pillar = signal.pillar as Pillar;
            const placeholderColor = pillar ? PILLAR_PLACEHOLDERS[pillar] : "#1a1a1a";

            return (
              <div
                key={signal.id || index}
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
                        {signal.source_name || "Source"}
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
                    onClick={() => handleGoDeeper(signal)}
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
                  <p className="title">{signal.title || "Untitled"}</p>
                  <p className="meta">
                    {signal.source_name || "Unknown"} · {signal.published_date 
                      ? new Date(signal.published_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                      : "No date"
                    }
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
