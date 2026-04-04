// Content Engine Types — Feed → Write → Schedule → Results

export type ContentFormat = "LinkedIn post" | "Thread" | "Reel script" | "WhatsApp broadcast" | "X post";
export type PostStatus = "draft" | "scheduled" | "live" | "done";
export type Pillar = "Pain Points" | "Build Journey" | "Marketing Tips" | "Client Results";

export interface Signal {
  id: string;
  headline: string;
  source: string;
  url?: string;
  date: string;
  pillar: Pillar;
  isCustom?: boolean;
}

export interface VoiceSettings {
  style: string;
}

export interface ScheduledPost {
  id: string;
  topic: string;
  channel: string;
  date: string;
  time: string;
  status: PostStatus;
  draft?: string;
  pillar?: Pillar;
}

export interface SprintData {
  startDate: string;
  postsThisWeek: number;
  postsTarget: number;
}

export interface PostResult {
  id: string;
  topic: string;
  channel: string;
  date: string;
  pillar: Pillar;
  views: number;
  comments: number;
  replies: number;
  dms: number;
}

export interface PillarPerformance {
  pillar: Pillar;
  posts: number;
  totalEngagement: number;
}

export const DEFAULT_VOICE_STYLE = `Raw, vulnerable, first person. Short punchy sentences. No corporate fluff. Conversational like texting a friend. Every post ends with CTA like "DM me DEMO" or "Comment LEADS".`;

export const CONTENT_FORMATS: ContentFormat[] = [
  "LinkedIn post",
  "Thread",
  "Reel script",
  "WhatsApp broadcast",
  "X post",
];

export const PILLARS: Pillar[] = [
  "Pain Points",
  "Build Journey",
  "Marketing Tips",
  "Client Results",
];

export const PILLAR_COLORS: Record<Pillar, { text: string; bg: string; border: string }> = {
  "Pain Points": {
    text: "var(--accent-red)",
    bg: "rgba(255,68,68,0.12)",
    border: "rgba(255,68,68,0.2)",
  },
  "Build Journey": {
    text: "var(--accent-green)",
    bg: "rgba(0,212,170,0.12)",
    border: "rgba(0,212,170,0.2)",
  },
  "Marketing Tips": {
    text: "var(--accent-blue)",
    bg: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.2)",
  },
  "Client Results": {
    text: "var(--accent-orange)",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.2)",
  },
};
