import { NextRequest } from "next/server";
import Parser from "rss-parser";

const rssParser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "ARC-ContentEngine/1.0",
  },
});

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

  // Extract snippet from contentSnippet or description
  const snippet = item.contentSnippet || item.summary || "";

  return {
    title: item.title || "Untitled",
    link: item.link || "",
    pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
    snippet: snippet.slice(0, 300),
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
