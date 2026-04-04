import { NextRequest } from "next/server";
import Parser from "rss-parser";

const rssParser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "ARC-ContentEngine/1.0",
  },
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return Response.json({ error: "URL parameter required" }, { status: 400 });
  }

  try {
    const feed = await rssParser.parseURL(url);
    
    const items = feed.items.slice(0, 10).map((item, index) => {
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
      
      // Extract snippet from content or description
      const snippet = item.contentSnippet 
        || item.content?.replace(/<[^>]*>/g, "").slice(0, 300)
        || item.summary
        || "";

      return {
        id: `rss-${Date.now()}-${index}`,
        title: item.title || "Untitled",
        link: item.link || "",
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        snippet: snippet.slice(0, 300),
        image,
      };
    });

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
