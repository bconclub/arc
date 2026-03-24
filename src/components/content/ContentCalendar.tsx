"use client";

import { useState, useEffect } from "react";
import { Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Topic,
  CalendarEntry,
  PILLAR_COLORS,
  PLATFORMS,
  Platform,
  FORMATS,
  ContentFormat,
} from "@/types/content";

interface ContentCalendarProps {
  entries: CalendarEntry[];
  topics: Topic[];
  onAdd: (entry: CalendarEntry) => void;
  weekTarget?: number;
}

function getWeekDays(): { label: string; date: string; dayName: string }[] {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day === 0 ? 7 : day) - 1));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      date: d.toISOString().split("T")[0],
      dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
    };
  });
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

export function ContentCalendar({ entries, topics, onAdd, weekTarget = 12 }: ContentCalendarProps) {
  const days = getWeekDays();
  const isMobile = useIsMobile();
  const todayIdx = days.findIndex((d) => d.date === new Date().toISOString().split("T")[0]);
  const [mobileDayIdx, setMobileDayIdx] = useState(todayIdx >= 0 ? todayIdx : 0);
  const [addingDay, setAddingDay] = useState<string | null>(null);
  const [form, setForm] = useState({ topicId: "", platform: "LinkedIn" as Platform, format: "Text Post" as ContentFormat });

  const weekEntries = entries.filter((e) => days.some((d) => d.date === e.day));
  const planned = weekEntries.length;
  const pct = Math.min((planned / weekTarget) * 100, 100);

  const schedulableTopics = topics.filter((t) => t.status === "idea" || t.status === "scheduled");

  const handleAdd = () => {
    const topic = topics.find((t) => t.id === form.topicId);
    if (!topic || !addingDay) return;
    onAdd({
      id: Date.now().toString(36),
      topicId: topic.id,
      topicTitle: topic.title,
      pillar: topic.pillar,
      platform: form.platform,
      format: form.format,
      day: addingDay,
    });
    setForm({ topicId: "", platform: "LinkedIn", format: "Text Post" });
    setAddingDay(null);
  };

  const visibleDays = isMobile ? [days[mobileDayIdx]] : days;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[13px] font-medium text-text tracking-tight">Content Calendar</h3>
        <span className="text-xs text-text-muted font-mono tracking-tight">
          {planned}/{weekTarget} planned
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/[0.03] rounded-full mb-6 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: pct >= 100 ? "var(--accent-green)" : pct >= 50 ? "var(--accent-blue)" : "rgba(255,255,255,0.15)",
          }}
        />
      </div>

      {/* Mobile day nav */}
      {isMobile && (
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setMobileDayIdx((i) => Math.max(0, i - 1))}
            disabled={mobileDayIdx === 0}
            className="p-2 rounded-lg text-text-muted hover:text-text disabled:opacity-20 transition-all duration-150"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5">
            {days.map((d, i) => (
              <button
                key={d.date}
                onClick={() => setMobileDayIdx(i)}
                className={`w-8 h-8 rounded-full text-[10px] font-mono transition-all duration-200 ${
                  i === mobileDayIdx
                    ? "bg-white text-black font-medium"
                    : d.date === new Date().toISOString().split("T")[0]
                    ? "text-white"
                    : "text-text-muted hover:text-text"
                }`}
              >
                {d.dayName[0]}
              </button>
            ))}
          </div>
          <button
            onClick={() => setMobileDayIdx((i) => Math.min(6, i + 1))}
            disabled={mobileDayIdx === 6}
            className="p-2 rounded-lg text-text-muted hover:text-text disabled:opacity-20 transition-all duration-150"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Week/Day grid */}
      <div className={isMobile ? "grid grid-cols-1 gap-3" : "grid grid-cols-7 gap-3"}>
        {visibleDays.map((day) => {
          const dayEntries = entries.filter((e) => e.day === day.date);
          const isToday = day.date === new Date().toISOString().split("T")[0];
          return (
            <div
              key={day.date}
              className={`bg-bg/50 rounded-xl p-3 ${isMobile ? "min-h-[200px]" : "min-h-[140px]"} ${isToday ? "ring-1 ring-white/10" : ""}`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div>
                  <span className="section-heading block">{day.dayName}</span>
                  <span className={`text-xs font-mono tracking-tight ${isToday ? "text-white font-medium" : "text-text-muted"}`}>
                    {day.label}
                  </span>
                </div>
                <button
                  onClick={() => setAddingDay(addingDay === day.date ? null : day.date)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.04] text-text-muted hover:text-text transition-all duration-150"
                >
                  {addingDay === day.date ? <X size={12} /> : <Plus size={12} />}
                </button>
              </div>

              {addingDay === day.date && (
                <div className="mb-2.5 p-2.5 bg-surface border border-[rgba(255,255,255,0.06)] rounded-lg space-y-2 animate-dropdown">
                  <select
                    value={form.topicId}
                    onChange={(e) => setForm((f) => ({ ...f, topicId: e.target.value }))}
                    className="w-full bg-bg border border-[rgba(255,255,255,0.06)] rounded-lg px-2 py-1.5 text-[11px] text-text transition-all"
                  >
                    <option value="">Pick topic...</option>
                    {schedulableTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title.length > 30 ? t.title.slice(0, 30) + "..." : t.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={form.platform}
                    onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value as Platform }))}
                    className="w-full bg-bg border border-[rgba(255,255,255,0.06)] rounded-lg px-2 py-1.5 text-[11px] text-text transition-all"
                  >
                    {PLATFORMS.filter((p) => p !== "All").map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <select
                    value={form.format}
                    onChange={(e) => setForm((f) => ({ ...f, format: e.target.value as ContentFormat }))}
                    className="w-full bg-bg border border-[rgba(255,255,255,0.06)] rounded-lg px-2 py-1.5 text-[11px] text-text transition-all"
                  >
                    {FORMATS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAdd}
                    disabled={!form.topicId}
                    className="btn-primary w-full px-2 py-1.5 text-[11px] font-medium bg-white text-black rounded-lg hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              )}

              <div className="space-y-1.5">
                {dayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-2 bg-surface border border-[rgba(255,255,255,0.04)] rounded-lg text-[10px] leading-snug hover:border-[rgba(255,255,255,0.08)] transition-all duration-200"
                  >
                    <div className="flex items-start gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full mt-1 shrink-0"
                        style={{ backgroundColor: PILLAR_COLORS[entry.pillar] }}
                      />
                      <span className="text-text">{entry.topicTitle.length > 25 ? entry.topicTitle.slice(0, 25) + "..." : entry.topicTitle}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 pl-3">
                      <span className="text-text-muted">{entry.platform}</span>
                      <span className="text-text-muted/30">·</span>
                      <span className="text-text-muted">{entry.format}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
