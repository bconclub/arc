import type { RawTrend, SourceRow } from "./index";

interface RedditPost {
  id: string;
  title: string;
  url: string;
  permalink: string;
  score: number;
  num_comments: number;
  selftext: string;
  subreddit: string;
  created_utc: number;
  link_flair_text?: string;
}

export async function fetchReddit(row: SourceRow): Promise<RawTrend[]> {
  const subreddit = row.handle ?? "marketing";
  const limit = (row.config?.limit as number) ?? 25;
  const sort = (row.config?.sort as string) ?? "hot";
  const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "arc-agent/0.1" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error(`[reddit/${subreddit}] HTTP ${res.status}`);
      return [];
    }

    const json = await res.json();
    const posts: RedditPost[] = (json?.data?.children ?? []).map(
      (c: { data: RedditPost }) => c.data,
    );

    const now = Date.now() / 1000;
    return posts.map((post) => {
      const ageHrs = Math.max(0.01, (now - post.created_utc) / 3600);
      const velocity = post.score / ageHrs;

      return {
        external_id: `reddit-${post.id}`,
        title: post.title.trim(),
        url: post.url || `https://reddit.com${post.permalink}`,
        velocity,
        raw: {
          source: "reddit",
          subreddit: post.subreddit,
          score: post.score,
          num_comments: post.num_comments,
          selftext: post.selftext.slice(0, 300),
          flair: post.link_flair_text ?? "",
          age_hrs: Math.round(ageHrs * 10) / 10,
        },
      };
    });
  } catch (e) {
    console.error(`[reddit/${subreddit}] fetch failed:`, e);
    return [];
  }
}
