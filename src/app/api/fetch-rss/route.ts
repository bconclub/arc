import { NextRequest } from "next/server";
import Parser from "rss-parser";

const rssParser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "ARC-ContentEngine/1.0",
  },
  customFields: {
    item: [
      ["content:encoded", "contentEncoded"],
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
    ],
  },
});

// Pull the first usable <img> src out of an HTML blob (handles most feeds that
// embed the hero image in the article body instead of a media tag).
function extractImageFromHtml(html: string): string {
  if (!html) return "";
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!match) return "";
  const url = match[1];
  // Skip tracking pixels / 1x1 spacers
  if (/(1x1|pixel|spacer|blank\.gif|doubleclick|feedburner)/i.test(url)) return "";
  return url.startsWith("//") ? `https:${url}` : url;
}

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  snippet: string;
  image: string;
  source_name: string;
}

// Legacy GET handler for single URL (backward compatibility)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return Response.json({ error: "URL parameter required" }, { status: 400 });
  }

  try {
    const feed = await rssParser.parseURL(url);
    const items = feed.items.slice(0, 10).map((item) => parseRSSItem(item, feed.title || extractSourceName(url)));

    return Response.json({
      data: items,
      meta: {
        title: feed.title,
        description: feed.description,
        link: feed.link,
      }
    });
  } catch (error) {
    console.error("RSS fetch error:", error);
    return Response.json(
      { error: "Failed to fetch RSS feed", details: (error as Error).message },
      { status: 500 }
    );
  }
}

// Fetch a page's OpenGraph image (og:image / twitter:image) as a last-resort
// image source for feeds that ship no image in their RSS (TechCrunch, HN, etc.).
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
    // Only read the <head> — bail after ~50KB to stay fast.
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

// Run async tasks with a concurrency cap (keeps OG fetching from stampeding).
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

// New POST handler for multiple URLs
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { urls } = body as { urls: string[] };

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return Response.json({ error: "urls array required" }, { status: 400 });
    }

    // Fetch all feeds in parallel
    const results = await Promise.allSettled(
      urls.map(async (url) => {
        try {
          const feed = await rssParser.parseURL(url);
          const items = feed.items.slice(0, 10).map((item) => 
            parseRSSItem(item, feed.title || extractSourceName(url))
          );
          return {
            url,
            success: true,
            items,
            meta: {
              title: feed.title,
              description: feed.description,
              link: feed.link,
            }
          };
        } catch (error) {
          console.error(`RSS fetch error for ${url}:`, error);
          return {
            url,
            success: false,
            error: (error as Error).message,
            items: [] as RSSItem[],
          };
        }
      })
    );

    // Merge all successful items into a single array
    const allItems: RSSItem[] = results
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((r: any) => r.status === 'fulfilled' && r.value.success === true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .flatMap((r: any) => r.value.items as RSSItem[]);

    // Sort by pubDate descending (newest first)
    allItems.sort((a, b) => {
      const dateA = new Date(a.pubDate).getTime();
      const dateB = new Date(b.pubDate).getTime();
      return dateB - dateA;
    });

    // OG-image fallback: for items still missing an image, fetch the article's
    // og:image. Capped concurrency + per-request timeout to keep the feed snappy.
    const needsImage = allItems.filter((it) => !it.image && it.link);
    if (needsImage.length > 0) {
      await mapWithLimit(needsImage, 6, async (it) => {
        const og = await fetchOgImage(it.link);
        if (og) it.image = og;
      });
    }

    const failedCount = results.filter(r => r.status === 'rejected' || !r.value.success).length;

    return Response.json({
      data: allItems,
      meta: {
        total: allItems.length,
        sources: urls.length,
        failed: failedCount,
      }
    });
  } catch (error) {
    console.error("RSS batch fetch error:", error);
    return Response.json(
      { error: "Failed to fetch RSS feeds", details: (error as Error).message },
      { status: 500 }
    );
  }
}

function parseRSSItem(
  item: Parser.Item, 
  sourceName: string
): RSSItem {
  // Try to extract image from various RSS formats
  let image = "";

  // enclosure
  if (item.enclosure?.url) {
    image = item.enclosure.url;
  }

  // media:content
  const mediaContent = (item as Record<string, unknown>)["media:content"] as { $?: { url: string }; url?: string } | undefined;
  if (mediaContent?.$?.url) {
    image = mediaContent.$.url;
  } else if (mediaContent?.url) {
    image = mediaContent.url;
  }

  // media:thumbnail
  const mediaThumbnail = (item as Record<string, unknown>)["media:thumbnail"] as { $?: { url: string }; url?: string } | undefined;
  if (mediaThumbnail?.$?.url) {
    image = mediaThumbnail.$.url;
  } else if (mediaThumbnail?.url) {
    image = mediaThumbnail.url;
  }

  // media:group (YouTube, etc)
  const mediaGroup = (item as Record<string, unknown>)["media:group"] as {
    "media:thumbnail"?: { $?: { url: string } }[]
  } | undefined;
  if (mediaGroup?.["media:thumbnail"]?.[0]?.$?.url) {
    image = mediaGroup["media:thumbnail"][0].$.url;
  }

  const rec = item as Record<string, unknown>;

  // media:content captured via customFields (can be array)
  if (!image) {
    const mc = rec.mediaContent as Array<{ $?: { url?: string; medium?: string; type?: string } }> | undefined;
    if (Array.isArray(mc)) {
      const img = mc.find((m) => m?.$?.url && (!m.$.medium || m.$.medium === "image") && !/video/i.test(m.$.type || ""));
      if (img?.$?.url) image = img.$.url;
    }
  }

  // media:thumbnail captured via customFields
  if (!image) {
    const mt = rec.mediaThumbnail as { $?: { url?: string } } | undefined;
    if (mt?.$?.url) image = mt.$.url;
  }

  // Fallback: pull the first <img> out of the full article HTML.
  // This is what fills images for most blog/news feeds (Inc42, TechCrunch, etc.)
  if (!image) {
    const html =
      (rec.contentEncoded as string) ||
      (item.content as string) ||
      (rec["content:encoded"] as string) ||
      "";
    image = extractImageFromHtml(html);
  }

  // Extract snippet from contentSnippet or description
  const snippet = item.contentSnippet || item.summary || "";

  // Clean up whitespace and give the card a fuller excerpt (was 300).
  const cleanSnippet = snippet.replace(/\s+/g, " ").trim().slice(0, 500);

  return {
    title: item.title || "Untitled",
    link: item.link || "",
    pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
    snippet: cleanSnippet,
    image,
    source_name: sourceName,
  };
}

function extractSourceName(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    // Remove TLD and capitalize
    return hostname
      .split(".")[0]
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  } catch {
    return "Unknown Source";
  }
}
