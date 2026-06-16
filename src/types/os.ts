// ARC OS — the business-operating-system layer.
// Goals → Needs → (Plays → Work) → Results. Today screen surfaces ranked Needs.

export type Lane = "outreach" | "content" | "delivery" | "build";

export const LANE_META: Record<Lane, { label: string; color: string; bg: string }> = {
  outreach: { label: "Outreach", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  content:  { label: "Content",  color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  delivery: { label: "Delivery", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  build:    { label: "Build",    color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
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
