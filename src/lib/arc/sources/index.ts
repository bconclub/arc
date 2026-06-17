export interface RawTrend {
  external_id: string;
  title: string;
  url: string;
  velocity: number;
  raw: Record<string, unknown>;
}

export interface SourceRow {
  id: number;
  kind: string;
  handle: string | null;
  enabled: boolean;
  config: Record<string, unknown>;
}

export type SourceFetcher = (row: SourceRow) => Promise<RawTrend[]>;

export { fetchProductHunt } from "./producthunt";
export { fetchReddit } from "./reddit";
export { fetchYouTube } from "./youtube";
export { fetchX } from "./x";

import { fetchProductHunt } from "./producthunt";
import { fetchReddit } from "./reddit";
import { fetchYouTube } from "./youtube";
import { fetchX } from "./x";

export const SOURCE_MAP: Record<string, SourceFetcher> = {
  producthunt: fetchProductHunt,
  reddit: fetchReddit,
  youtube: fetchYouTube,
  x: fetchX,
};
