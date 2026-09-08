// Shared RSS engine for the content feed.
// Used in-process by /api/fetch-rss, /api/ai (fetch-signals) and /api/arc/sync
// so there is NO internal HTTP hop (which Vercel deployment protection would block).
import Parser from "rss-parser";
import { supabaseAdmin } from "@/lib/supabase";

const rssParser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "ARC-ContentEngine/1.0" },
  customFields: {
    item: [
      ["content:encoded", "contentEncoded"],
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
    ],
  },
});

export interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  snippet: string;
  image: string;
  source_name: string;
}

// ── scoring ────────────────────────────────────────────────
// Recency: today=90, yesterday=70, 2d=50, older=30
export function calculateTrendScore(pubDate: string): number {
  const now = new Date();
  const date = new Date(pubDate);
  const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (isNaN(diffDays)) return 50;
  if (diffDays < 1) return 90;
  if (diffDays < 2) return 70;
  if (diffDays < 3) return 50;
  return 30;
}

export function getLabelFromScore(score: number): "hot" | "rising" | "steady" {
  if (score >= 80) return "hot";
  if (score >= 60) return "rising";
  return "steady";
}

import { icpBoost } from "@/lib/icp";

const DEMOTE_KEYWORDS = ["stock", "shares", "ipo", "crypto", "bitcoin", "fund raises", "block deal", "quarterly results"];

/** ICP phrase/anchor match, minus market noise. No random factor. */
export function relevanceBoost(title: string, snippet: string): number {
  const text = `${title} ${snippet}`.toLowerCase();
  let boost = icpBoost(title, snippet);
  if (DEMOTE_KEYWORDS.some((t) => text.includes(t))) boost -= 20;
  return boost;
}

// ── image extraction ───────────────────────────────────────
function extractImageFromHtml(html: string): string {
  if (!html) return "";
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!match) return "";
  const url = match[1];
  if (/(1x1|pixel|spacer|blank\.gif|doubleclick|feedburner)/i.test(url)) return "";
  return url.startsWith("//") ? `https:${url}` : url;
}

async function fetchOgImage(pageUrl: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(pageUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ARC-ContentEngine/1.0)" },
    });
    clearTimeout(timer);
    if (!res.ok) return "";
    const reader = res.body?.getReader();
    if (!reader) return "";
    const decoder = new TextDecoder();
    let html = "";
    while (html.length < 50000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (html.includes("</head>")) break;
    }
    reader.cancel().catch(() => {});
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (!m) return "";
    const url = m[1].trim();
    return url.startsWith("//") ? `https:${url}` : url;
  } catch {
    return "";
  }
}

async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

function parseRSSItem(item: Parser.Item, sourceName: string): RSSItem {
  let image = "";
  if (item.enclosure?.url) image = item.enclosure.url;

  const rec = item as Record<string, unknown>;
  const mediaContent = rec["media:content"] as { $?: { url: string }; url?: string } | undefined;
  if (mediaContent?.$?.url) image = mediaContent.$.url;
  else if (mediaContent?.url) image = mediaContent.url;

  const mediaThumbnail = rec["media:thumbnail"] as { $?: { url: string }; url?: string } | undefined;
  if (mediaThumbnail?.$?.url) image = mediaThumbnail.$.url;
  else if (mediaThumbnail?.url) image = mediaThumbnail.url;

  const mediaGroup = rec["media:group"] as { "media:thumbnail"?: { $?: { url: string } }[] } | undefined;
  if (mediaGroup?.["media:thumbnail"]?.[0]?.$?.url) image = mediaGroup["media:thumbnail"][0].$!.url;

  if (!image) {
    const mc = rec.mediaContent as Array<{ $?: { url?: string; medium?: string; type?: string } }> | undefined;
    if (Array.isArray(mc)) {
      const img = mc.find((m) => m?.$?.url && (!m.$.medium || m.$.medium === "image") && !/video/i.test(m.$.type || ""));
      if (img?.$?.url) image = img.$.url;
    }
  }
  if (!image) {
    const mt = rec.mediaThumbnail as { $?: { url?: string } } | undefined;
    if (mt?.$?.url) image = mt.$.url;
  }
  if (!image) {
    const html =
      (rec.contentEncoded as string) || (item.content as string) || (rec["content:encoded"] as string) || "";
    image = extractImageFromHtml(html);
  }

  const snippet = (item.contentSnippet || item.summary || "").replace(/\s+/g, " ").trim().slice(0, 500);

  return {
    title: item.title || "Untitled",
    link: item.link || "",
    pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
    snippet,
    image,
    source_name: sourceName,
  };
}

export function extractSourceName(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname.split(".")[0].replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  } catch {
    return "Unknown Source";
  }
}

// Fetch + parse many feeds in parallel, in-process. Optionally backfill missing
// images via og:image (slower, disable for cron syncs to stay under time limits).
export async function fetchFeeds(urls: string[], opts: { ogFallback?: boolean } = {}): Promise<RSSItem[]> {
  const { ogFallback = true } = opts;
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const feed = await rssParser.parseURL(url);
      return feed.items.slice(0, 15).map((item) => parseRSSItem(item, feed.title || extractSourceName(url)));
    })
  );

  const allItems: RSSItem[] = results
    .filter((r): r is PromiseFulfilledResult<RSSItem[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  if (ogFallback) {
    const needsImage = allItems.filter((it) => !it.image && it.link);
    if (needsImage.length > 0) {
      await mapWithLimit(needsImage, 6, async (it) => {
        const og = await fetchOgImage(it.link);
        if (og) it.image = og;
      });
    }
  }

  return allItems;
}

export interface CacheRow {
  title: string;
  url: string;
  snippet: string;
  source_name: string;
  image_url: string;
  published_date: string;
  trend_score: number;
  label: string;
  saved: boolean;
}

// ── cache (signals table) ──────────────────────────────────
// The signals table is a pure cache (saved items live in saved_signals).
// We key freshness on created_at because the table has no fetched_at column.
const FRESH_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function readSignalsCache(): Promise<CacheRow[] | null> {
  try {
    const since = new Date(Date.now() - FRESH_MS).toISOString();
    const { data, error } = await supabaseAdmin
      .from("signals")
      .select("title,url,snippet,source_name,image_url,published_date,trend_score,label,saved")
      .gte("created_at", since)
      .order("trend_score", { ascending: false })
      .limit(150);
    if (error) {
      console.error("[cache] read error:", error.message);
      return null;
    }
    return data && data.length >= 5 ? (data as unknown as CacheRow[]) : null;
  } catch (e) {
    console.error("[cache] read failed:", e);
    return null;
  }
}

// Replace the cache with a fresh batch. Returns rows written.
export async function writeSignalsCache(rows: CacheRow[]): Promise<number> {
  try {
    const now = new Date().toISOString();
    const payload = rows.map((r) => ({ ...r, created_at: now }));
    // Clear the cache, then write the fresh batch (signals is disposable).
    await supabaseAdmin.from("signals").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const { error } = await supabaseAdmin.from("signals").insert(payload);
    if (error) {
      console.error("[cache] write error:", error.message);
      return 0;
    }
    return payload.length;
  } catch (e) {
    console.error("[cache] write failed:", e);
    return 0;
  }
}

// Turn raw feed items into scored, cache-ready signal rows.
export function itemsToSignals(items: RSSItem[]): CacheRow[] {
  return items.map((r) => {
    const score = calculateTrendScore(r.pubDate) + relevanceBoost(r.title, r.snippet);
    return {
      title: r.title,
      url: r.link,
      snippet: r.snippet,
      source_name: r.source_name,
      image_url: r.image || "",
      published_date: r.pubDate,
      trend_score: Math.round(score),
      label: getLabelFromScore(score),
      saved: false,
    };
  });
}
