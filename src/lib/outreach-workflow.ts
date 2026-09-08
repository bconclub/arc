import type { OutreachTarget, OutreachMessage } from "@/types/ops";

export const OUTCOMES = {
  call: [
    "queued",
    "ringing",
    "connected",
    "no_answer",
    "callback",
    "interested",
    "not_interested",
    "wrong_number",
    "failed",
    "cancelled",
  ],
  citation: [
    "pending",
    "in_progress",
    "submitted",
    "live",
    "rejected",
    "blocked",
  ],
  email: ["pending", "drafted", "sent", "replied", "failed"],
  whatsapp: ["pending", "sent", "replied", "failed"],
  linkedin: ["pending", "sent", "replied", "failed"],
} as const;
export type ActivityChannel = keyof typeof OUTCOMES;
export type WorkState = "pending" | "in_progress" | "done" | "blocked";
export type OutreachActivity = {
  id: string;
  target_id: string;
  channel: ActivityChannel;
  outcome: string;
  worker: string;
  external_id: string;
  occurred_at: string;
  summary: string;
  evidence_url: string | null;
  next_at: string | null;
  legacy?: boolean;
};
export function workState(outcome: string): WorkState {
  if (["failed", "blocked", "rejected", "wrong_number"].includes(outcome))
    return "blocked";
  if (["ringing", "in_progress", "submitted", "sent"].includes(outcome))
    return "in_progress";
  if (
    [
      "handed_off",
      "won",
      "lost",
      "connected",
      "interested",
      "not_interested",
      "cancelled",
      "live",
      "replied",
    ].includes(outcome)
  )
    return "done";
  return "pending";
}
export function outcomeLabel(outcome: string): string {
  const labels: Record<string, string> = {
    qualified: "Qualified · handoff pending",
    handed_off: "Handed to PROXe",
    no_answer: "No answer · retry needed",
    callback: "Callback requested",
    submitted: "Submitted · awaiting review",
    live: "Verified live",
    ringing: "Call in progress",
    pending: "Not started",
    queued: "Queued",
    unknown: "Call logged · outcome unknown",
    unverified: "Marked sent · needs verification",
    wrong_number: "Wrong number",
    not_interested: "Not interested",
  };
  return (
    labels[outcome] ||
    outcome.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
  );
}
export function isTestTarget(
  t: Pick<OutreachTarget, "name" | "source" | "segment"> & {
    phone?: string | null;
  },
): boolean {
  if (t.phone?.replace(/\D/g, "").slice(-10) === "9731660933") return true;
  return /(^|[\s_-])(test|test_dial)([\s_-]|$)/i.test(
    [t.name, t.source, t.segment].filter(Boolean).join(" "),
  );
}
export function safeUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.includes(":") ? value : `https://${value}`);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function legacyActivity(m: OutreachMessage): OutreachActivity {
  const disposition = m.body?.match(/DISPOSITION:\s*([^\n]+)/i)?.[1]?.trim();
  const outcome =
    m.channel === "call"
      ? disposition || "unknown"
      : m.direction === "in"
        ? "replied"
        : m.sent_at
          ? "sent"
          : "drafted";
  return {
    id: `message:${m.id}`,
    target_id: m.target_id,
    channel: m.channel,
    outcome,
    worker: "Legacy record",
    external_id: m.id,
    occurred_at: m.sent_at || m.created_at,
    summary: m.body || m.subject || "No details recorded",
    evidence_url: null,
    next_at: null,
    legacy: true,
  };
}
export function latestActivity(
  rows: OutreachActivity[],
  channel?: ActivityChannel,
): OutreachActivity | undefined {
  return rows
    .filter((a) => !channel || a.channel === channel)
    .sort(
      (a, b) =>
        Date.parse(b.occurred_at) - Date.parse(a.occurred_at) ||
        b.id.localeCompare(a.id),
    )[0];
}
export function citationOutcome(
  target: OutreachTarget,
  rows: OutreachActivity[],
): string {
  const latest = latestActivity(rows, "citation");
  if (latest) return latest.outcome;
  if (["sent", "won", "replied", "meeting"].includes(target.status))
    return "unverified";
  if (target.status === "lost") return "blocked";
  return "pending";
}
