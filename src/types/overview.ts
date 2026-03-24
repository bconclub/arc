export interface Metric {
  label: string;
  value: string;
  prev?: string;
}

export interface ChannelMetrics {
  [key: string]: Metric;
}

export interface MetricHistory {
  key: string;
  channel: string;
  oldValue: string;
  newValue: string;
  timestamp: string;
}

export interface WeeklyLogEntry {
  id: string;
  date: string;
  channel: string;
  action: string;
  result: string;
  notes: string;
}

export const CHANNELS = ["LinkedIn", "Instagram", "Twitter/X", "WhatsApp", "Sales"] as const;
export type Channel = (typeof CHANNELS)[number];
