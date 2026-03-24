export const PILLARS = ["Pain Points", "Marketing Tips", "Build Journey", "Client Results"] as const;
export type Pillar = (typeof PILLARS)[number];

export const PILLAR_COLORS: Record<Pillar, string> = {
  "Pain Points": "var(--accent-red)",
  "Marketing Tips": "var(--accent-blue)",
  "Build Journey": "var(--accent-green)",
  "Client Results": "var(--accent-orange)",
};

export const PILLAR_BG: Record<Pillar, string> = {
  "Pain Points": "rgba(255,68,68,0.1)",
  "Marketing Tips": "rgba(59,130,246,0.1)",
  "Build Journey": "rgba(0,212,170,0.1)",
  "Client Results": "rgba(245,158,11,0.1)",
};

export type TopicStatus = "idea" | "scheduled" | "published" | "repurposed";
export type Platform = "LinkedIn" | "Instagram" | "Twitter" | "All";
export type ContentFormat = "Text Post" | "Carousel" | "Reel" | "Video" | "Story";
export type DraftStatus = "draft" | "ready" | "posted";

export interface Topic {
  id: string;
  title: string;
  pillar: Pillar;
  status: TopicStatus;
  platform: Platform;
  campaignId?: string;
}

// Campaign types
export type CampaignStatus = "Planning" | "Active" | "Completed" | "Paused";

export const CAMPAIGN_STATUSES: CampaignStatus[] = ["Planning", "Active", "Completed", "Paused"];

export const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, { text: string; bg: string }> = {
  Active: { text: "var(--accent-green)", bg: "rgba(0,212,170,0.1)" },
  Planning: { text: "var(--accent-blue)", bg: "rgba(59,130,246,0.1)" },
  Paused: { text: "var(--accent-orange)", bg: "rgba(245,158,11,0.1)" },
  Completed: { text: "var(--text-muted)", bg: "rgba(136,136,136,0.1)" },
};

export interface CampaignMetrics {
  impressions: string;
  engagement: string;
  dmsReceived: string;
  demosBooked: string;
}

export interface Campaign {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  platforms: Platform[];
  pillar: Pillar | "All";
  status: CampaignStatus;
  performanceNotes: string;
  metrics: CampaignMetrics;
}

export interface CalendarEntry {
  id: string;
  topicId: string;
  topicTitle: string;
  pillar: Pillar;
  platform: Platform;
  format: ContentFormat;
  day: string; // ISO date string YYYY-MM-DD
}

export interface Draft {
  id: string;
  title: string;
  body: string;
  platform: Platform;
  status: DraftStatus;
  createdAt: string;
  pillar?: Pillar;
}

export const STATUSES: TopicStatus[] = ["idea", "scheduled", "published", "repurposed"];
export const PLATFORMS: Platform[] = ["LinkedIn", "Instagram", "Twitter", "All"];
export const FORMATS: ContentFormat[] = ["Text Post", "Carousel", "Reel", "Video", "Story"];
