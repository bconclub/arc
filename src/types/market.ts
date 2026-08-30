import type {
  KeywordCluster,
  KeywordIntent,
  KeywordSource,
  KeywordStatus,
  KeywordVertical,
} from "@/lib/icp";

export type KeywordRow = {
  id: string;
  phrase: string;
  cluster: KeywordCluster;
  vertical: KeywordVertical;
  intent: KeywordIntent;
  source: KeywordSource;
  status: KeywordStatus;
  rank_score: number;
  hits: number;
  evidence: string;
  last_seen_at: string | null;
};

export type ConnectionProbe = {
  key: string;
  name: string;
  kind: "proxe" | "rss" | "tavily";
  configured: boolean;
  ok: boolean | null;
  detail: string;
  hits?: number;
};
