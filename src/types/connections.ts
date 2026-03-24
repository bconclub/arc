export type ConnectionStatus = "Connected" | "Not Connected" | "Error";

export interface ConnectedSource {
  id: string;
  name: string;
  storageKeyPrefix: string;
  status: ConnectionStatus;
  lastSync: string | null;
}

export type FeedType = "Social Hashtag" | "Forum" | "Marketplace" | "News Alert" | "Competitor";
export const FEED_TYPES: FeedType[] = ["Social Hashtag", "Forum", "Marketplace", "News Alert", "Competitor"];

export type FeedStatus = "Active" | "Paused";

export interface ListeningFeed {
  id: string;
  name: string;
  type: FeedType;
  url: string;
  status: FeedStatus;
  notes: string;
}
