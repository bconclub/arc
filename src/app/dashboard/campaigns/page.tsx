"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, Circle, Flame, Moon, Sun } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useAI } from "@/hooks/useAI";
import { AIButton } from "@/components/ai/AIButton";
import { AIPanel } from "@/components/ai/AIPanel";
import {
  SCHEDULE,
  BLOCK_COLORS,
  getBlockMinutes,
  formatTime,
  formatBlockTime,
  DEFAULT_TARGETS,
  type ScheduleBlock,
  type DailyTarget,
} from "@/lib/schedule";
import type { ChannelMetrics } from "@/types/overview";
import {
  defaultLinkedIn,
  defaultInstagram,
  defaultTwitter,
  defaultSalesPipeline,
  defaultWhatsApp,
} from "@/lib/defaults";

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function nowMinutes(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

function SprintHeader({
  sprintStart,
  targetsHit,
  totalTargets,
}: {
  sprintStart: string;
  targetsHit: number;
  totalTargets: number;
}) {
  const start = new Date(sprintStart + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayNum = Math.max(1, Math.floor((today.getTime() - start.getTime()) / 86400000) + 1);
  const dayDisplay = Math.min(dayNum, 90);

  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-4">
        <div>
          <span className="text-3xl font-bold font-mono text-white tracking-tighter">
            Day {dayDisplay}
          </span>
          <span className="text-sm text-text-muted font-normal ml-1.5">/ 90</span>
        </div>
        <div className="w-28 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${(dayDisplay / 90) * 100}%`,
              backgroundColor: "var(--accent-green)",
            }}
          />
        </div>
      </div>
      <span className="text-sm font-mono">
        <span className="text-white font-bold tracking-tighter">{targetsHit}</span>
        <span className="text-text-muted">/{totalTargets} targets</span>
      </span>
    </div>
  );
}

function NowCard({ block, nowMin }: { block: ScheduleBlock | null; nowMin: number }) {
  if (!block) return null;

  const { start, end } = getBlockMinutes(block);
  const total = end - start;
  const elapsed = nowMin - start;
  const remaining = end - nowMin;
  const pct = Math.min(Math.max((elapsed / total) * 100, 0), 100);
  const colors = BLOCK_COLORS[block.type];

  const remH = Math.floor(remaining / 60);
  const remM = remaining % 60;
  const remStr = remH > 0 ? `${remH}h ${remM}m left` : `${remM}m left`;

  return (
    <div
      className="relative rounded-2xl p-7 sm:p-8 overflow-hidden"
      style={{ backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1 }}
    >
      <div
        className="absolute top-0 left-0 w-full h-1 rounded-t-2xl"
        style={{ backgroundColor: colors.accent }}
      />

      <div className="flex items-start justify-between mb-1">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.15em]"
          style={{ color: colors.accent }}
        >
          NOW
        </span>
        <span className="text-xs font-mono text-text-muted tracking-tight">
          {formatBlockTime(block)}
        </span>
      </div>

      <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tighter mt-2">
        {block.title}
      </h2>
      <p className="text-sm text-text-muted mt-1.5">{block.description}</p>

      <div className="mt-7 flex items-center gap-3">
        <div className="flex-1 h-2 bg-black/30 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${pct}%`, backgroundColor: colors.accent }}
          />
        </div>
        <span
          className="text-sm font-mono font-bold shrink-0 tracking-tight"
          style={{ color: colors.accent }}
        >
          {remStr}
        </span>
      </div>
    </div>
  );
}

function OffHours({ message, icon }: { message: string; icon: "morning" | "evening" }) {
  return (
    <div className="card p-10 sm:p-14 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.03] mb-5">
        {icon === "morning" ? (
          <Sun size={24} className="text-accent-orange/60" />
        ) : (
          <Moon size={24} className="text-text-muted/40" />
        )}
      </div>
      <p className="text-base text-text-muted">{message}</p>
    </div>
  );
}

function NextUpCard({ block }: { block: ScheduleBlock | null }) {
  if (!block) return null;
  const colors = BLOCK_COLORS[block.type];

  return (
    <div className="card p-5">
      <span className="section-heading block mb-3">Next Up</span>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: colors.accent }}
          />
          <span className="text-[15px] font-semibold text-text tracking-tight">{block.title}</span>
        </div>
        <span className="text-xs font-mono text-text-muted tracking-tight">
          {formatTime(block.startHour, block.startMin)}
        </span>
      </div>
      <p className="text-xs text-text-muted mt-1.5 pl-5">{block.description}</p>
    </div>
  );
}

function RemainingBlocks({
  blocks,
  nowMin,
  currentId,
  nextId,
}: {
  blocks: ScheduleBlock[];
  nowMin: number;
  currentId: string | null;
  nextId: string | null;
}) {
  const rest = blocks.filter((b) => b.id !== currentId && b.id !== nextId);
  if (rest.length === 0) return null;

  return (
    <div className="card p-5">
      <span className="section-heading block mb-4">Today&apos;s Schedule</span>
      <div className="space-y-0.5">
        {rest.map((block) => {
          const { end } = getBlockMinutes(block);
          const done = nowMin >= end;
          const colors = BLOCK_COLORS[block.type];
          return (
            <div
              key={block.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                done ? "opacity-30" : "hover:bg-white/[0.03]"
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: colors.accent }}
              />
              <span className={`text-xs font-mono text-text-muted w-20 shrink-0 tracking-tight ${done ? "line-through" : ""}`}>
                {formatTime(block.startHour, block.startMin)}
              </span>
              <span className={`text-[13px] flex-1 ${done ? "text-text-muted line-through" : "text-text"}`}>
                {block.title}
              </span>
              <span className="text-[10px] text-text-muted/50 hidden sm:inline">
                {block.description.length > 40 ? block.description.slice(0, 40) + "..." : block.description}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DailyTargets({
  targets,
  onToggle,
  streak,
}: {
  targets: DailyTarget[];
  onToggle: (id: string) => void;
  streak: number;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <span className="section-heading">Daily Targets</span>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 text-accent-orange">
            <Flame size={12} />
            <span className="text-[10px] font-bold font-mono tracking-tight">{streak}d streak</span>
          </div>
        )}
      </div>
      <div className="space-y-0.5">
        {targets.map((t) => (
          <button
            key={t.id}
            onClick={() => onToggle(t.id)}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-all duration-150 text-left"
          >
            {t.checked ? (
              <CheckCircle2 size={16} className="text-accent-green shrink-0" />
            ) : (
              <Circle size={16} className="text-text-muted/30 shrink-0" />
            )}
            <span
              className={`text-[13px] ${
                t.checked ? "text-text-muted line-through" : "text-text"
              }`}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const now = useNow();
  const min = nowMinutes(now);

  const [sprintStart, setSprintStart] = useLocalStorage<string>("koex:sprint-start", todayKey());
  const [targetsHistory, setTargetsHistory] = useLocalStorage<Record<string, DailyTarget[]>>(
    "koex:daily-targets",
    {}
  );

  useEffect(() => {
    if (!sprintStart) setSprintStart(todayKey());
  }, [sprintStart, setSprintStart]);

  const key = todayKey();
  const todayTargets: DailyTarget[] =
    targetsHistory[key] ?? DEFAULT_TARGETS.map((t) => ({ ...t, checked: false }));

  const toggleTarget = useCallback(
    (id: string) => {
      setTargetsHistory((prev) => {
        const current = prev[key] ?? DEFAULT_TARGETS.map((t) => ({ ...t, checked: false }));
        const updated = current.map((t) => (t.id === id ? { ...t, checked: !t.checked } : t));
        return { ...prev, [key]: updated };
      });
    },
    [key, setTargetsHistory]
  );

  const calcStreak = (): number => {
    let streak = 0;
    const d = new Date();
    d.setDate(d.getDate() - 1);
    while (true) {
      const k = d.toISOString().split("T")[0];
      const day = targetsHistory[k];
      if (!day || !day.every((t) => t.checked)) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  };

  let currentBlock: ScheduleBlock | null = null;
  let nextBlock: ScheduleBlock | null = null;

  for (const block of SCHEDULE) {
    const { start, end } = getBlockMinutes(block);
    if (min >= start && min < end) {
      currentBlock = block;
    } else if (min < start && !nextBlock) {
      nextBlock = block;
    }
  }
  if (currentBlock && !nextBlock) {
    const idx = SCHEDULE.indexOf(currentBlock);
    if (idx < SCHEDULE.length - 1) nextBlock = SCHEDULE[idx + 1];
  }

  const beforeDay = min < 9 * 60;
  const afterDay = min >= 20 * 60;
  const targetsHit = todayTargets.filter((t) => t.checked).length;

  const briefingAI = useAI<string>();
  const [linkedin] = useLocalStorage<ChannelMetrics>("koex:linkedin", defaultLinkedIn);
  const [instagram] = useLocalStorage<ChannelMetrics>("koex:instagram", defaultInstagram);
  const [twitter] = useLocalStorage<ChannelMetrics>("koex:twitter", defaultTwitter);
  const [salesMetrics] = useLocalStorage<ChannelMetrics>("koex:sales", defaultSalesPipeline);
  const [whatsappMetrics] = useLocalStorage<ChannelMetrics>("koex:whatsapp", defaultWhatsApp);

  const start = new Date(sprintStart + "T00:00:00");
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const sprintDay = Math.max(1, Math.min(90, Math.floor((todayDate.getTime() - start.getTime()) / 86400000) + 1));

  const runBriefing = async () => {
    await briefingAI.trigger(
      "daily-briefing",
      {
        sprintDay,
        targets: todayTargets,
        metrics: { linkedin, instagram, twitter, sales: salesMetrics, whatsapp: whatsappMetrics },
        schedule: SCHEDULE.map((b) => `${formatTime(b.startHour, b.startMin)}-${formatTime(b.endHour, b.endMin)}: ${b.title}`),
        recentLog: [],
      },
      true
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tighter">Schedule</h1>
        <AIButton onClick={runBriefing} loading={briefingAI.loading} label="AI Briefing" />
      </div>

      <SprintHeader
        sprintStart={sprintStart}
        targetsHit={targetsHit}
        totalTargets={DEFAULT_TARGETS.length}
      />

      {(briefingAI.streamText || briefingAI.error) && (
        <AIPanel
          title="Morning Briefing"
          content={briefingAI.streamText}
          streaming={briefingAI.streaming}
          error={briefingAI.error}
          onClose={briefingAI.reset}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-5">
          {beforeDay ? (
            <OffHours message="Day hasn't started yet. First block at 9:00 AM." icon="morning" />
          ) : afterDay ? (
            <OffHours message="Day complete. Rest up for tomorrow." icon="evening" />
          ) : (
            <>
              <NowCard block={currentBlock} nowMin={min} />
              <NextUpCard block={nextBlock} />
            </>
          )}
          <RemainingBlocks
            blocks={SCHEDULE}
            nowMin={min}
            currentId={currentBlock?.id ?? null}
            nextId={nextBlock?.id ?? null}
          />
        </div>

        <div>
          <DailyTargets
            targets={todayTargets}
            onToggle={toggleTarget}
            streak={calcStreak()}
          />
        </div>
      </div>
    </div>
  );
}
