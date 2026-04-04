"use client";

import { useState, useMemo } from "react";
import { Globe, Clock, Lock, Unlock, Check } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { ScheduledPost, SprintData } from "@/types/content-engine";

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  LinkedIn: <Globe size={14} />,
  Instagram: <Globe size={14} />,
  WhatsApp: <Globe size={14} />,
  Twitter: <Globe size={14} />,
  X: <Globe size={14} />,
};

const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  scheduled: { text: "var(--accent-blue)", bg: "rgba(59,130,246,0.12)" },
  live: { text: "var(--accent-orange)", bg: "rgba(245,158,11,0.12)" },
  done: { text: "var(--accent-green)", bg: "rgba(0,212,170,0.12)" },
};

function getSprintDay(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, Math.min(days, 90));
}

function getWeekDays(): string[] {
  const days = [];
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    days.push(day.toISOString().split("T")[0]);
  }
  return days;
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
  const dayNum = date.getDate();
  return isToday ? `Today ${dayNum}` : `${dayName} ${dayNum}`;
}

export default function SchedulePage() {
  const [schedule, setSchedule] = useLocalStorage<ScheduledPost[]>("arc:schedule", []);
  const [sprint] = useLocalStorage<SprintData>("arc:sprint", {
    startDate: "2026-01-01",
    postsThisWeek: 0,
    postsTarget: 7,
  });
  const [overrideId, setOverrideId] = useState<string | null>(null);

  const sprintDay = getSprintDay(sprint.startDate);
  const weekDays = getWeekDays();

  const postsThisWeek = useMemo(() => {
    return schedule.filter(p => weekDays.includes(p.date) && (p.status === "scheduled" || p.status === "live" || p.status === "done")).length;
  }, [schedule, weekDays]);

  const handleStatusChange = (id: string, newStatus: ScheduledPost["status"]) => {
    setSchedule(schedule.map(p => p.id === id ? { ...p, status: newStatus } : p));
    setOverrideId(null);
  };

  const getPostsForDay = (date: string) => {
    return schedule
      .filter(p => p.date === date)
      .sort((a, b) => a.time.localeCompare(b.time));
  };

  return (
    <div className="min-h-[calc(100vh-120px)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Schedule</h1>
          <p className="text-[13px] text-text-muted mt-0.5">
            Day {sprintDay}/90 · {postsThisWeek} posts this week
          </p>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-text-muted">Sprint progress</span>
          <span className="text-[11px] text-text-muted">{postsThisWeek}/{sprint.postsTarget} this week</span>
        </div>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${Math.min((postsThisWeek / sprint.postsTarget) * 100, 100)}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {weekDays.map((date) => {
          const posts = getPostsForDay(date);
          const isToday = date === new Date().toISOString().split("T")[0];
          
          return (
            <div
              key={date}
              className={`card p-4 ${isToday ? "border-white/20" : ""}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[12px] font-medium ${isToday ? "text-text" : "text-text-muted"}`}>
                  {formatDayLabel(date)}
                </span>
                {isToday && (
                  <span className="text-[10px] px-2 py-0.5 bg-white/10 rounded-full text-text">
                    Today
                  </span>
                )}
              </div>

              {posts.length === 0 ? (
                <div className="py-3 text-center">
                  <span className="text-[12px] text-text-muted/60">No posts</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="flex items-center justify-between p-3 bg-surface rounded-lg group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-text-muted">
                          {CHANNEL_ICONS[post.channel] || <Globe size={14} />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] text-text truncate">{post.topic}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-text-muted flex items-center gap-1">
                              <Clock size={10} />
                              {post.time}
                            </span>
                            {post.pillar && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-text-muted">
                                {post.pillar}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] px-2 py-1 rounded-full font-medium capitalize"
                          style={{
                            color: STATUS_COLORS[post.status].text,
                            backgroundColor: STATUS_COLORS[post.status].bg,
                          }}
                        >
                          {post.status}
                        </span>
                        
                        {post.status !== "done" && (
                          overrideId === post.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleStatusChange(post.id, "live")}
                                className="p-1.5 rounded bg-accent-orange/20 text-accent-orange hover:bg-accent-orange/30"
                                title="Mark as live"
                              >
                                <Unlock size={12} />
                              </button>
                              <button
                                onClick={() => handleStatusChange(post.id, "done")}
                                className="p-1.5 rounded bg-accent-green/20 text-accent-green hover:bg-accent-green/30"
                                title="Mark as done"
                              >
                                <Check size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setOverrideId(post.id)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-white/[0.06] text-text-muted hover:text-text transition-all"
                              title="Override"
                            >
                              <Lock size={12} />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
