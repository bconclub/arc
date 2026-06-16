// ARC OS — the business-operating-system layer.
// Goals → Needs → (Plays → Work) → Results. Today screen surfaces ranked Needs.

// Focused to what we run today: outreach, content, and market (industry watch).
export type Lane = "outreach" | "content" | "market";

export const LANE_META: Record<Lane, { label: string; color: string; bg: string }> = {
  outreach: { label: "Outreach", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  content:  { label: "Content",  color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  market:   { label: "Market",   color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
};

export interface Goal {
  id: string;
  title: string;       // e.g. "100 clients in 90 days"
  metric: string;      // e.g. "clients"
  target: number;      // 100
  current: number;     // 14
  deadline: string;    // ISO date
}

export type NeedStatus = "suggested" | "approved" | "done" | "dismissed";

export interface Need {
  id: string;
  lane: Lane;
  title: string;        // "Follow up 12 warm leads"
  why: string;          // grounded reason (ties to a goal / analytics signal)
  priority: number;     // 0-100, drives ranking
  effort: "quick" | "medium" | "deep";
  status: NeedStatus;
  createdAt: string;
}

// Every suggest→approve/dismiss is logged — this is the data that lets ARC
// eventually run a lane autonomously once approval rate is consistently high.
export interface Interaction {
  needId: string;
  lane: Lane;
  action: "approved" | "dismissed";
  at: string;
}

// ── Outreach ────────────────────────────────────────────────
export type LeadStage = "new" | "contacted" | "replied" | "booked" | "won" | "cold";
export type Channel = "email" | "whatsapp" | "linkedin" | "instagram";

export interface Lead {
  id: string;
  name: string;
  company: string;
  role: string;
  industry: string;
  region: string;          // "India", "US", etc.
  channel: Channel;
  stage: LeadStage;
  fit: number;             // 0-100 ICP fit score
  why: string;             // why reach out now
  lastTouch: string | null; // ISO date or null
  handle?: string;         // email / @handle
}

export interface Product {
  id: string;
  name: string;            // PROXe / BCON Club
  tagline: string;
  pitch: string;
  bestFor: string;
}

export const STAGE_META: Record<LeadStage, { label: string; color: string; bg: string }> = {
  new:       { label: "New",       color: "#a1a1aa", bg: "rgba(161,161,170,0.12)" },
  contacted: { label: "Contacted", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  replied:   { label: "Replied",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  booked:    { label: "Booked",    color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
  won:       { label: "Won",       color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  cold:      { label: "Cold",      color: "#6b6b6b", bg: "rgba(107,107,107,0.12)" },
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  instagram: "Instagram",
};
