// Sources system - RSS, Reddit, URL, Tavily Search

export type SourceType = "rss" | "reddit" | "url" | "tavily_search";

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  value: string;
  active: boolean;
  addedAt: string;
}

export interface RawSignal {
  title: string;
  url: string;
  snippet: string;
  publishedDate: string;
  sourceName: string;
  sourceType: SourceType;
  image?: string;
  score?: number; // For Reddit upvotes
}

export const DEFAULT_SOURCES: Source[] = [
  {
    id: "default-1",
    name: "r/entrepreneur",
    type: "reddit",
    value: "entrepreneur",
    active: true,
    addedAt: new Date().toISOString(),
  },
  {
    id: "default-2",
    name: "r/digitalnomad",
    type: "reddit",
    value: "digitalnomad",
    active: true,
    addedAt: new Date().toISOString(),
  },
  {
    id: "default-3",
    name: "WhatsApp Business India",
    type: "tavily_search",
    value: "WhatsApp business India leads 2025",
    active: true,
    addedAt: new Date().toISOString(),
  },
  {
    id: "default-4",
    name: "Meta Ads SMB India",
    type: "tavily_search",
    value: "Meta ads SMB India",
    active: true,
    addedAt: new Date().toISOString(),
  },
  {
    id: "default-5",
    name: "AI Tools Founder Productivity",
    type: "tavily_search",
    value: "AI tools founder productivity",
    active: true,
    addedAt: new Date().toISOString(),
  },
];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  rss: "RSS Feed",
  reddit: "Subreddit",
  url: "Webpage",
  tavily_search: "Search Query",
};

export const SOURCE_TYPE_ICONS: Record<SourceType, string> = {
  rss: "📰",
  reddit: "🔴",
  url: "🌐",
  tavily_search: "🔍",
};
