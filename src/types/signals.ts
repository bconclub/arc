// Signal types for ARC Feed
import { icpBoost } from "@/lib/icp";

export { ICP_KEYWORDS } from "@/lib/icp";

export type SourceType = "rss" | "tavily_search";
export type Pillar = "pain_points" | "build_journey" | "marketing_tips" | "client_results";
export type TrendLabel = "hot" | "rising" | "steady";

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  value: string;
  active: boolean;
  added_at: string;
}

export interface Signal {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source_name: string;
  image_url?: string;
  published_date: string;
  pillar?: Pillar;
  trend_score: number;
  label: TrendLabel;
  saved: boolean;
  saved_at?: string;
  notes?: string;
  created_at: string;
}

export interface RawSignal {
  title: string;
  url: string;
  snippet: string;
  image?: string;
  publishedDate: string;
  sourceName: string;
  sourceType: SourceType;
}

export function calculateTrendScore(title: string, snippet: string, publishedDate: string): { score: number; label: TrendLabel } {
  // Recency score
  let recency = 30;
  try {
    const pubDate = new Date(publishedDate);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) recency = 100;
    else if (diffDays === 1) recency = 80;
    else if (diffDays === 2) recency = 60;
    else recency = 30;
  } catch {
    recency = 30;
  }

  const icpScore = Math.min(100, icpBoost(title, snippet));
  const score = Math.round((recency * 0.55) + (icpScore * 0.45));

  // Label
  let label: TrendLabel = "steady";
  if (score >= 80) label = "hot";
  else if (score >= 60) label = "rising";

  return { score, label };
}

export function detectPillar(title: string, snippet: string): Pillar {
  const text = (title + " " + snippet).toLowerCase();
  
  if (text.includes("result") || text.includes("case study") || text.includes("client") || text.includes("revenue") || text.includes("mrr") || text.includes("arr")) {
    return "client_results";
  }
  if (text.includes("how to") || text.includes("tips") || text.includes("guide") || text.includes("strategy") || text.includes("hack")) {
    return "marketing_tips";
  }
  if (text.includes("build") || text.includes("launch") || text.includes("product") || text.includes("startup") || text.includes("shipping")) {
    return "build_journey";
  }
  if (text.includes("struggle") || text.includes("problem") || text.includes("fail") || text.includes("mistake") || text.includes("pain")) {
    return "pain_points";
  }
  
  return "build_journey";
}

export function getTrendBadge(label: TrendLabel, score: number): { text: string; icon: string; color: string; bg: string } {
  switch (label) {
    case "hot":
      return { text: `Hot ${score}`, icon: "▲", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" };
    case "rising":
      return { text: `Rising ${score}`, icon: "↑", color: "#14b8a6", bg: "rgba(20, 184, 166, 0.15)" };
    default:
      return { text: `Steady ${score}`, icon: "·", color: "#6b6b6b", bg: "rgba(107, 107, 107, 0.15)" };
  }
}

export const DEFAULT_SOURCES: Omit<Source, "id" | "added_at">[] = [
  { name: "Inc42", type: "rss", value: "https://inc42.com/feed/", active: true },
  { name: "YourStory", type: "rss", value: "https://yourstory.com/feed", active: true },
  { name: "Neil Patel", type: "rss", value: "https://neilpatel.com/blog/feed/", active: true },
  { name: "Ben's Bites", type: "rss", value: "https://www.bensbites.com/feed", active: true },
  { name: "Marketing Brew", type: "rss", value: "https://www.marketingbrew.com/feeds/newsletter", active: true },
  { name: "WhatsApp India", type: "tavily_search", value: "WhatsApp business leads India 2026", active: true },
  { name: "Meta Ads India", type: "tavily_search", value: "Meta ads small business India 2026", active: true },
  { name: "AI Sales", type: "tavily_search", value: "AI follow-up sales automation India", active: true },
];
