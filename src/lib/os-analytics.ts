// ARC OS — Pulse analytics layer (stubbed v1).
//
// Shapes mirror the real APIs so swapping stub → live is a data-source change only:
//  - Microsoft Clarity (Data Export API): sessions, scroll depth, dead/rage clicks, top pages
//  - Meta Ads (Marketing API / the live MCP): campaigns with spend, ROAS, results
// When wired, `getClarity()` / `getMetaAds()` become real fetches; the UI stays identical.

export interface Metric {
  label: string;
  value: string;
  delta?: number;       // % change vs previous period (+/-)
  hint?: string;
}

export interface TopPage {
  path: string;
  sessions: number;
  scrollDepth: number;  // avg % scrolled
  deadClicks: number;
}

export interface ClarityData {
  range: string;
  metrics: Metric[];
  topPages: TopPage[];
}

export interface AdCampaign {
  name: string;
  status: "active" | "paused";
  spend: number;
  results: number;
  resultLabel: string;  // "leads", "messages", etc.
  roas: number;
}

export interface MetaAdsData {
  range: string;
  metrics: Metric[];
  campaigns: AdCampaign[];
}

// ── Clarity (stub) ──────────────────────────────────────────────
export function getClarity(): ClarityData {
  return {
    range: "Last 7 days",
    metrics: [
      { label: "Sessions", value: "3,412", delta: 12, hint: "vs prev 7d" },
      { label: "Avg scroll depth", value: "48%", delta: -4, hint: "people leave mid-page" },
      { label: "Dead clicks", value: "214", delta: 9, hint: "clicks that did nothing" },
      { label: "Rage clicks", value: "37", delta: -18, hint: "frustration signal" },
    ],
    topPages: [
      { path: "/", sessions: 1840, scrollDepth: 52, deadClicks: 61 },
      { path: "/proxe", sessions: 720, scrollDepth: 44, deadClicks: 88 },
      { path: "/bcon", sessions: 410, scrollDepth: 39, deadClicks: 41 },
      { path: "/pricing", sessions: 298, scrollDepth: 61, deadClicks: 24 },
    ],
  };
}

// ── Meta Ads (stub — real MCP is connected, wire at connections stage) ──
export function getMetaAds(): MetaAdsData {
  return {
    range: "Last 7 days",
    metrics: [
      { label: "Spend", value: "₹48,200", delta: 6, hint: "vs prev 7d" },
      { label: "Leads", value: "126", delta: 22, hint: "from ads" },
      { label: "Cost / lead", value: "₹382", delta: -13, hint: "lower is better" },
      { label: "Blended ROAS", value: "3.4x", delta: 8 },
    ],
    campaigns: [
      { name: "PROXe — WhatsApp leads (IN)", status: "active", spend: 22400, results: 71, resultLabel: "leads", roas: 4.1 },
      { name: "BCON cohort — retargeting", status: "active", spend: 11800, results: 28, resultLabel: "signups", roas: 2.9 },
      { name: "PROXe — clinics lookalike", status: "active", spend: 9200, results: 19, resultLabel: "leads", roas: 2.2 },
      { name: "Brand awareness — reels", status: "paused", spend: 4800, results: 8, resultLabel: "leads", roas: 1.1 },
    ],
  };
}

// ── Industry / market watch (stub — wire to the real feed later) ──
export interface MarketItem {
  headline: string;
  source: string;
  soWhat: string;       // why it matters to US specifically
  tag: "competitor" | "trend" | "regulation" | "opportunity";
}

export function getMarketWatch(): { items: MarketItem[] } {
  return {
    items: [
      { headline: "Google must let sites opt out of AI Search (UK CMA)", source: "Search Engine Journal", soWhat: "Publishers gaining control over AI = a trust angle our ICP cares about. Good post + sales talking point.", tag: "regulation" },
      { headline: "3 clinic-software players shipped AI front-desk this week", source: "Industry watch", soWhat: "Rivals moving into PROXe's lane. Sharpen the 'never forgets a follow-up' wedge before they own it.", tag: "competitor" },
      { headline: "WhatsApp Business API opens cheaper tiers in India", source: "Inc42", soWhat: "Lowers PROXe's delivery cost for Indian SMBs. Bake into pricing + the India outreach pitch.", tag: "opportunity" },
      { headline: "US SMBs cite 'slow lead response' as #1 growth leak (survey)", source: "MarTech", soWhat: "Third-party proof of the exact problem we sell against. Use as the cold-email hook for US.", tag: "trend" },
    ],
  };
}

// ── Content results (real-ish: from our own results store later) ──
export function getContentPulse(): { metrics: Metric[] } {
  return {
    metrics: [
      { label: "Posts shipped", value: "2 / 5", hint: "this week" },
      { label: "Avg reach", value: "4,120", delta: 15 },
      { label: "Replies / DMs", value: "63", delta: 31 },
      { label: "Top post", value: "fastest reply wins", hint: "8.2k reach" },
    ],
  };
}
