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
  { lane: "outreach", title: "Follow up 12 warm leads who went quiet", why: "100-clients goal is behind pace (14/100). 12 leads haven't been touched in 4+ days. fastest path to closes.", priority: 95, effort: "medium" },
  { lane: "outreach", title: "Draft re-engage to Priya (LearnLeap)", why: "Top-fit coaching academy (91), DM'd 3d ago, opened no reply. one nudge could book a demo.", priority: 88, effort: "quick" },
  { lane: "content", title: "Ship a post on 'fastest reply wins'", why: "Only 2/5 posts this week. matches your style guide and last week's top performer.", priority: 82, effort: "quick" },
  { lane: "outreach", title: "Send 15 cold emails to US realtors", why: "US market is open. realtors lose after-hours leads to time-zone gap. PROXe's clearest US wedge.", priority: 78, effort: "medium" },
  { lane: "market", title: "Google forcing AI-scraping split — angle for a post", why: "Trending in your feed (AI + marketing). publishers gaining control = a take your ICP cares about.", priority: 66, effort: "quick" },
  { lane: "content", title: "Turn 'Snowflake AI marketing' signal into a post", why: "High-relevance signal in your feed (AI + marketing). riding a trending topic lifts reach.", priority: 60, effort: "quick" },
  { lane: "market", title: "3 competitors launched AI booking this week", why: "Industry watch: rivals shipping AI front-desk. worth a positioning post + sharper PROXe pitch.", priority: 52, effort: "medium" },
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
