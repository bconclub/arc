export type BlockType = "selling" | "content" | "delivery" | "dev" | "admin";

export interface ScheduleBlock {
  id: string;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  title: string;
  description: string;
  type: BlockType;
}

export const BLOCK_COLORS: Record<BlockType, { accent: string; bg: string; border: string }> = {
  selling:  { accent: "var(--accent-green)",  bg: "rgba(0,212,170,0.08)",  border: "rgba(0,212,170,0.25)" },
  content:  { accent: "var(--accent-blue)",   bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.25)" },
  delivery: { accent: "var(--accent-orange)", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)" },
  dev:      { accent: "#a855f7",              bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.25)" },
  admin:    { accent: "var(--text-muted)",    bg: "rgba(136,136,136,0.06)", border: "rgba(136,136,136,0.2)" },
};

export const SCHEDULE: ScheduleBlock[] = [
  { id: "b1",  startHour: 9,  startMin: 0,  endHour: 9,  endMin: 30, title: "ARC Check-in",           description: "Log yesterday's numbers, check today's plan",                    type: "admin" },
  { id: "b2",  startHour: 9,  startMin: 30, endHour: 10, endMin: 30, title: "Content Ship",              description: "Write, finalize, publish today's post on LinkedIn + IG",          type: "content" },
  { id: "b3",  startHour: 10, startMin: 30, endHour: 11, endMin: 0,  title: "Engagement",                description: "15 ICP comments, reply to all DMs and comments",                 type: "content" },
  { id: "b4",  startHour: 11, startMin: 0,  endHour: 13, endMin: 0,  title: "Outreach & Sales Block 1",  description: "Send 20 DMs, follow up warm leads, book demos",                  type: "selling" },
  { id: "b5",  startHour: 13, startMin: 0,  endHour: 14, endMin: 0,  title: "Break",                     description: "Lunch & recharge",                                               type: "admin" },
  { id: "b6",  startHour: 14, startMin: 0,  endHour: 15, endMin: 30, title: "Demos",                     description: "All demos in this window. If no demo, more outreach",             type: "selling" },
  { id: "b7",  startHour: 15, startMin: 30, endHour: 17, endMin: 30, title: "Client Delivery",           description: "BCON active clients, ads, PROXe setup",                          type: "delivery" },
  { id: "b8",  startHour: 17, startMin: 30, endHour: 19, endMin: 0,  title: "Dev Block",                 description: "PROXe product work, bug fixes, features",                        type: "dev" },
  { id: "b9",  startHour: 19, startMin: 0,  endHour: 19, endMin: 30, title: "Outreach Block 2",          description: "Evening DMs, follow up afternoon conversations",                 type: "selling" },
  { id: "b10", startHour: 19, startMin: 30, endHour: 20, endMin: 0,  title: "ARC End-of-Day",         description: "Log activity, update metrics, prep tomorrow",                    type: "admin" },
];

export function getBlockMinutes(block: ScheduleBlock): { start: number; end: number } {
  return {
    start: block.startHour * 60 + block.startMin,
    end: block.endHour * 60 + block.endMin,
  };
}

export function formatTime(hour: number, min: number): string {
  const h = hour % 12 || 12;
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${h}:${min.toString().padStart(2, "0")} ${ampm}`;
}

export function formatBlockTime(block: ScheduleBlock): string {
  return `${formatTime(block.startHour, block.startMin)}, ${formatTime(block.endHour, block.endMin)}`;
}

export interface DailyTarget {
  id: string;
  label: string;
  checked: boolean;
}

export const DEFAULT_TARGETS: Omit<DailyTarget, "checked">[] = [
  { id: "t1", label: "1 post shipped" },
  { id: "t2", label: "30 DMs sent" },
  { id: "t3", label: "15 ICP comments" },
  { id: "t4", label: "2 hours client delivery" },
  { id: "t5", label: "1.5 hours dev" },
  { id: "t6", label: "ARC updated twice" },
];
