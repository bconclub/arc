import { NextRequest } from "next/server";
import { fetchFeeds } from "@/lib/arc/rss";

export const runtime = "nodejs";

// Legacy GET handler for a single URL (backward compatibility).
export async function GET(req: NextRequest) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) return Response.json({ error: "URL parameter required" }, { status: 400 });

  try {
    const data = await fetchFeeds([url], { ogFallback: false });
    return Response.json({ data, meta: { total: data.length } });
  } catch (error) {
    console.error("RSS fetch error:", error);
    return Response.json(
      { error: "Failed to fetch RSS feed", details: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST handler for multiple URLs — delegates to the shared in-process engine.
export async function POST(req: NextRequest) {
  try {
    const { urls } = (await req.json()) as { urls: string[] };
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return Response.json({ error: "urls array required" }, { status: 400 });
    }
    const data = await fetchFeeds(urls, { ogFallback: true });
    return Response.json({
      data,
      meta: { total: data.length, sources: urls.length },
    });
  } catch (error) {
    console.error("RSS batch fetch error:", error);
    return Response.json(
      { error: "Failed to fetch RSS feeds", details: (error as Error).message },
      { status: 500 }
    );
  }
}
