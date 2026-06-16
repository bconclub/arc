// ARC OS — the "decide" brain (stubbed v1).
//
// Right now this generates a realistic, ranked set of Needs from seed logic so the
// Today screen is fully clickable. Later this becomes an AI call that reads real
// goals + Pulse analytics (Clarity, Meta Ads) + lane state and returns ranked needs.
// The shape it returns is final — only the source of truth swaps from stub → real.

import type { Goal, Need, Lane } from "@/types/os";

export const DEFAULT_GOALS: Goal[] = [
  { id: "g1", title: "100 clients in 90 days", metric: "clients", target: 100, current: 14, deadline: "2026-08-30" },
  { id: "g2", title: "3 BCON cohort signups / week", metric: "signups", target: 3, current: 1, deadline: "2026-06-12" },
  { id: "g3", title: "Publish 5 posts / week", metric: "posts", target: 5, current: 2, deadline: "2026-06-12" },
];

// Seed needs — written in-voice, each grounded in a goal or a (stubbed) signal.
// `why` always cites WHY ARC is suggesting it, so the user can trust the ranking.
const SEED: Omit<Need, "id" | "status" | "createdAt">[] = [
  { lane: "outreach", title: "Follow up 12 warm leads who went quiet", why: "100-clients goal is behind pace (14/100). 12 leads haven't been touched in 4+ days — fastest path to closes.", priority: 95, effort: "medium" },
  { lane: "content", title: "Ship a post on 'fastest reply wins'", why: "Only 2/5 posts this week. This theme matches your style guide and last week's top performer.", priority: 82, effort: "quick" },
  { lane: "outreach", title: "Send 20 cold DMs to coaching academies", why: "Coaching academies are top-converting ICP. Pipeline needs fresh top-of-funnel to hit 100 clients.", priority: 78, effort: "medium" },
  { lane: "delivery", title: "3 client deliverables due this week", why: "Delivery keeps clients — 3 items are due before Friday. Slipping risks churn against the 100-client goal.", priority: 70, effort: "deep" },
  { lane: "build", title: "Wire ARC Today → real lead data", why: "Outreach + delivery lanes are running on stubs. Connecting the lead store unlocks real suggestions.", priority: 55, effort: "deep" },
  { lane: "content", title: "Turn 'Snowflake AI marketing' signal into a post", why: "High-relevance signal in your feed (AI + marketing). Riding a trending topic lifts reach.", priority: 60, effort: "quick" },
  { lane: "build", title: "Push BCON cohort landing tweak", why: "BCON signups behind (1/3 this week). A clearer CTA on the landing page is the cheapest lever.", priority: 48, effort: "medium" },
];

export function generateNeeds(): Need[] {
  const now = new Date().toISOString();
  return SEED
    .map((s, i) => ({ ...s, id: `n${i + 1}`, status: "suggested" as const, createdAt: now }))
    .sort((a, b) => b.priority - a.priority);
}

export function laneNeeds(needs: Need[], lane: Lane): Need[] {
  return needs.filter((n) => n.lane === lane);
}
