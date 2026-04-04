// Personalization Brain - Recursive self-improving voice system

export interface BrainConfig {
  id: string;
  rawInputs: {
    toneWords: string;
    samplePosts: string[];
    whatLanded: string;
    whatFlopped: string;
  };
  generatedSystemPrompt: string;
  version: number;
  updatedAt: string;
}

export interface TrendScore {
  score: number;
  recencyScore: number;
  volumeScore: number;
  icpMatchScore: number;
}

export interface SignalWithTrend {
  title: string;
  url: string;
  snippet: string;
  published_date: string;
  source: string;
  trendScore: TrendScore;
}

export const DEFAULT_BRAIN_CONFIG: BrainConfig = {
  id: "default",
  rawInputs: {
    toneWords: "raw, direct, no fluff, builder",
    samplePosts: [],
    whatLanded: "",
    whatFlopped: "",
  },
  generatedSystemPrompt: `You are a ghostwriter for a founder.

Voice: Raw, vulnerable, first person. Short punchy sentences. No corporate fluff. Conversational like texting a friend. Every post ends with CTA like "DM me DEMO" or "Comment LEADS".

Format guidelines:
- LinkedIn: Longer form storytelling (800-1200 chars). Hook in first line. Line breaks between sentences. End with CTA.
- X: Tight single banger or thread format. Max 280 chars per tweet. If thread, number them 1/ 2/ 3/.
- Reel script: Hook in first 3 seconds. Short sentences for voiceover. Include visual cues in [brackets]. CTA at end.
- WhatsApp broadcast: Conversational, personal tone. Use first person. Keep under 300 chars. Direct ask at end.

Write based on the topic and context provided. No meta-commentary. Just the post ready to publish.`,
  version: 1,
  updatedAt: new Date().toISOString(),
};

// ICP Keywords for trend scoring
export const ICP_KEYWORDS = [
  "WhatsApp",
  "leads",
  "India",
  "ads",
  "founder",
  "AI",
  "follow-up",
  "follow up",
  "automation",
  "SMB",
  "small business",
  "coaching",
  "clinic",
  "real estate",
  "tutoring",
  "Meta",
  "Facebook",
  "Instagram",
  "marketing",
  "sales",
  "demo",
  "booking",
];

// Trend score thresholds
export const TREND_BADGES = {
  HOT: { emoji: "🔥", label: "Hot", minScore: 80 },
  RISING: { emoji: "⚡", label: "Rising", minScore: 60 },
  NEUTRAL: { emoji: "·", label: "Neutral", minScore: 0 },
};

export function getTrendBadge(score: number): { emoji: string; label: string; color: string } {
  if (score >= 80) return { emoji: "🔥", label: "Hot", color: "var(--accent-red)" };
  if (score >= 60) return { emoji: "⚡", label: "Rising", color: "var(--accent-orange)" };
  return { emoji: "·", label: "Neutral", color: "var(--text-muted)" };
}
