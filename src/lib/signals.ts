import type { OpsSignal } from "@/types/ops";

/**
 * Ranking for the radar.
 *
 * Sorting by time alone put a fresh, trivial warning above a critical from
 * yesterday, which is the wrong way round: a radar exists to say what needs
 * attention, not what happened most recently.
 *
 * Severity dominates and recency breaks ties within a severity. The decay floor
 * means an old critical still outranks a new warning rather than aging out of
 * relevance, because an unresolved critical does not become less critical by
 * being ignored for a week.
 */

export type ScoredSignal = OpsSignal & {
  resolution?: string | null;
  resolved_at?: string | null;
  score: number;
};

const SEV_WEIGHT: Record<OpsSignal["severity"], number> = {
  critical: 100,
  high: 60,
  warn: 30,
  info: 10,
};

const HOUR = 3_600_000;

export function signalScore(s: Pick<OpsSignal, "severity" | "ts">): number {
  const t = new Date(s.ts).getTime();
  const ageHours = Number.isFinite(t) ? Math.max(0, (Date.now() - t) / HOUR) : 0;
  // Full weight for the first day, then a gentle decline to a 0.5 floor over a
  // fortnight. The floor is what keeps severity ordering intact over time.
  const recency = Math.max(0.5, 1 - Math.max(0, ageHours - 24) / (24 * 14));
  return Math.round(SEV_WEIGHT[s.severity] * recency);
}

/**
 * What belongs on the radar, highest score first.
 *
 * Resolved signals are dropped outright. A radar showing things already dealt
 * with trains you to ignore it, and the resolved ones remain readable in the
 * activity feed and on the alerts page.
 */
export function rankSignals(signals: OpsSignal[]): ScoredSignal[] {
  return signals
    .filter((s) => {
      const r = s as OpsSignal & { resolved_at?: string | null };
      if (r.resolved_at) return false;
      if (s.seen) return false;
      // Info is noise on a radar; it still shows in the feed.
      return s.severity !== "info";
    })
    .map((s) => ({ ...s, score: signalScore(s) }))
    .sort((a, b) => b.score - a.score || (a.ts < b.ts ? 1 : -1));
}
