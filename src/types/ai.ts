import type { Pillar, Platform } from "./content";

export type AIAction =
  | "generate-topics"
  | "write-post"
  | "analyze-metrics"
  | "generate-dms"
  | "daily-briefing";

export interface AIRequest {
  action: AIAction;
  payload: Record<string, unknown>;
}

export interface AIGeneratedTopic {
  title: string;
  pillar: Pillar;
  platform: Platform;
}

export interface AIDMScript {
  target: string;
  platform: string;
  opener: string;
  body: string;
  cta: string;
}

export interface AIAnalysis {
  summary: string;
  insights: string[];
  recommendations: string[];
}
