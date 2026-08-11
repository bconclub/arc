import type { RawTrend, SourceRow } from "./index";

export async function fetchX(row: SourceRow): Promise<RawTrend[]> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    console.log("[x] X_BEARER_TOKEN not set, skipping");
    return [];
  }

  const query = row.handle ?? "AI tools";
  const url =
    `https://api.twitter.com/2/tweets/search/recent` +
    `?query=${encodeURIComponent(query + " -is:retweet lang:en")}` +
    `&max_results=20&tweet.fields=created_at,public_metrics`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });

    if (res.status === 403) {
      console.log("[x] 403, free tier doesn't include search");
      return [];
    }
    if (!res.ok) {
      console.error(`[x] HTTP ${res.status}`);
      return [];
    }

    const json = await res.json();
    return (json.data ?? []).map((tweet: {
      id: string;
      text: string;
      created_at?: string;
      public_metrics?: { like_count: number; retweet_count: number };
    }) => {
      const m = tweet.public_metrics ?? { like_count: 0, retweet_count: 0 };
      const velocity = m.like_count + m.retweet_count * 2;

      return {
        external_id: `x-${tweet.id}`,
        title: tweet.text.slice(0, 200),
        url: `https://x.com/i/web/status/${tweet.id}`,
        velocity,
        raw: { source: "x", metrics: m, created_at: tweet.created_at ?? "" },
      };
    });
  } catch (e) {
    console.error("[x] fetch failed:", e);
    return [];
  }
}
