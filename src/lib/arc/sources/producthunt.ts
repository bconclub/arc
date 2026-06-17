import Parser from "rss-parser";
import type { RawTrend, SourceRow } from "./index";

const parser = new Parser({ timeout: 10000 });

export async function fetchProductHunt(row: SourceRow): Promise<RawTrend[]> {
  const maxItems = (row.config?.max_items as number) ?? 20;
  try {
    const feed = await parser.parseURL("https://www.producthunt.com/feed");
    const now = Date.now();

    return feed.items.slice(0, maxItems).map((item) => {
      const link = item.link ?? "";
      const extId = link.replace(/\/$/, "").split("/").pop() ?? crypto.randomUUID();
      const pubMs = item.pubDate ? new Date(item.pubDate).getTime() : now - 48 * 3600000;
      const ageHrs = Math.max(0.01, (now - pubMs) / 3600000);
      const velocity = Math.max(0, 100 - ageHrs * 2);

      return {
        external_id: `ph-${extId}`,
        title: item.title?.trim() ?? "Untitled",
        url: link,
        velocity,
        raw: {
          source: "producthunt",
          published: item.pubDate ?? "",
          summary: (item.contentSnippet ?? "").slice(0, 500),
        },
      };
    });
  } catch (e) {
    console.error("[producthunt] fetch failed:", e);
    return [];
  }
}
