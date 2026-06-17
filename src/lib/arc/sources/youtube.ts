import Parser from "rss-parser";
import type { RawTrend, SourceRow } from "./index";

const parser = new Parser({ timeout: 10000 });

// Curated channels (RSS, no API key)
const CHANNEL_RSS = [
  { id: "UCVHFbw7woebKtRljqxHK0mg", label: "Y Combinator" },
  { id: "UCnUYZLuoy1rq1aVMwx4aTzw", label: "Starter Story" },
  { id: "UCcefcZRL2oaA_uBNeo5UOWg", label: "YC Startup School" },
];

export async function fetchYouTube(row: SourceRow): Promise<RawTrend[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) return fetchViaAPI(row, apiKey);
  return fetchViaRSS();
}

async function fetchViaAPI(row: SourceRow, apiKey: string): Promise<RawTrend[]> {
  const region = (row.config?.region as string) ?? "IN";
  const maxResults = (row.config?.max_results as number) ?? 20;
  const url =
    `https://www.googleapis.com/youtube/v3/videos` +
    `?part=snippet,statistics&chart=mostPopular` +
    `&regionCode=${region}&videoCategoryId=28` +
    `&maxResults=${maxResults}&key=${apiKey}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return fetchViaRSS();
    const json = await res.json();
    const now = Date.now();

    return (json.items ?? []).map((item: {
      id: string;
      snippet: { title: string; channelTitle: string; publishedAt: string; description: string; thumbnails: { high?: { url: string } } };
      statistics: { viewCount?: string; likeCount?: string };
    }) => {
      const ageHrs = Math.max(0.01, (now - new Date(item.snippet.publishedAt).getTime()) / 3600000);
      const views = parseInt(item.statistics.viewCount ?? "0");
      const velocity = views / ageHrs;

      return {
        external_id: `yt-${item.id}`,
        title: item.snippet.title,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        velocity,
        raw: {
          source: "youtube",
          channel: item.snippet.channelTitle,
          views,
          likes: parseInt(item.statistics.likeCount ?? "0"),
          published: item.snippet.publishedAt,
          thumbnail: item.snippet.thumbnails?.high?.url ?? "",
        },
      };
    });
  } catch (e) {
    console.error("[youtube] API failed, falling back to RSS:", e);
    return fetchViaRSS();
  }
}

async function fetchViaRSS(): Promise<RawTrend[]> {
  const results: RawTrend[] = [];
  const now = Date.now();

  await Promise.allSettled(
    CHANNEL_RSS.map(async ({ id, label }) => {
      try {
        const feed = await parser.parseURL(
          `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`,
        );
        for (const entry of feed.items.slice(0, 5)) {
          const vidId =
            (entry as Record<string, string>)["yt:videoId"] ??
            (entry.id ?? "").split(":").pop() ??
            "";
          const pubMs = entry.pubDate ? new Date(entry.pubDate).getTime() : now - 48 * 3600000;
          const ageHrs = Math.max(0.01, (now - pubMs) / 3600000);

          results.push({
            external_id: `yt-${vidId}`,
            title: entry.title?.trim() ?? "Untitled",
            url: entry.link ?? `https://www.youtube.com/watch?v=${vidId}`,
            velocity: Math.max(0, 50 - ageHrs),
            raw: { source: "youtube_rss", channel: label, published: entry.pubDate ?? "" },
          });
        }
      } catch (e) {
        console.error(`[youtube] RSS for ${label} failed:`, e);
      }
    }),
  );

  return results;
}
