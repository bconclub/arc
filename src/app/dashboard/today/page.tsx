"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Zap, ArrowRight, Target } from "lucide-react";
import { LANE_META, type Need, type Goal, type Interaction } from "@/types/os";
import { DEFAULT_GOALS, generateNeeds } from "@/lib/os-decide";

const NEEDS_KEY = "arc:os:needs";
const LOG_KEY = "arc:os:log";

const EFFORT_LABEL: Record<Need["effort"], string> = {
  quick: "Quick",
  medium: "Medium",
  deep: "Deep",
};

export default function TodayPage() {
  const router = useRouter();
  const [goals] = useState<Goal[]>(DEFAULT_GOALS);
  const [needs, setNeeds] = useState<Need[]>([]);

  useEffect(() => {
    // Load persisted needs (with their statuses) or generate a fresh ranked set.
    try {
      const stored = localStorage.getItem(NEEDS_KEY);
      if (stored) {
        setNeeds(JSON.parse(stored));
        return;
      }
    } catch {}
    const fresh = generateNeeds();
    setNeeds(fresh);
    try {
      localStorage.setItem(NEEDS_KEY, JSON.stringify(fresh));
    } catch {}
  }, []);

  const persist = (next: Need[]) => {
    setNeeds(next);
    try {
      localStorage.setItem(NEEDS_KEY, JSON.stringify(next));
    } catch {}
  };

  const log = (need: Need, action: Interaction["action"]) => {
    try {
      const prev: Interaction[] = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
      prev.push({ needId: need.id, lane: need.lane, action, at: new Date().toISOString() });
      localStorage.setItem(LOG_KEY, JSON.stringify(prev));
    } catch {}
  };

  const approve = (need: Need) => {
    log(need, "approved");
    persist(needs.map((n) => (n.id === need.id ? { ...n, status: "approved" } : n)));
    // Route into the lane's engine.
    if (need.lane === "content") {
      router.push("/dashboard/write?topic=" + encodeURIComponent(need.title));
    } else if (need.lane === "outreach") {
      router.push("/dashboard/outreach");
    } else if (need.lane === "market") {
      router.push("/dashboard/feed");
    }
  };

  const dismiss = (need: Need) => {
    log(need, "dismissed");
    persist(needs.map((n) => (n.id === need.id ? { ...n, status: "dismissed" } : n)));
  };

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const active = needs.filter((n) => n.status === "suggested");
  const approved = needs.filter((n) => n.status === "approved");

  return (
    <div className="min-h-[calc(100vh-120px)] px-6 py-4 pb-24 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-text">Today</h1>
        <p className="text-[13px] text-text-muted mt-0.5">
          {today} · what the business needs, ranked
        </p>
      </div>

      {/* Goals strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        {goals.map((g) => {
          const pct = Math.min(100, Math.round((g.current / g.target) * 100));
          return (
            <div key={g.id} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target size={13} className="text-text-muted shrink-0" />
                <span className="text-[12px] font-medium text-text truncate">{g.title}</span>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-[20px] font-semibold text-text">{g.current}</span>
                <span className="text-[13px] text-text-muted">/ {g.target} {g.metric}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--glow-white)] overflow-hidden">
                <div className="h-full rounded-full bg-text transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Needs */}
      <div className="flex items-center gap-2 mb-3">
        <Zap size={16} className="text-text-muted" />
        <h2 className="text-[14px] font-medium text-text">Suggested for you</h2>
        <span className="text-[11px] text-text-muted/60">{active.length} open</span>
      </div>

      <div className="space-y-2.5 mb-8">
        {active.map((need) => {
          const lane = LANE_META[need.lane];
          return (
            <div key={need.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md shrink-0 mt-0.5"
                  style={{ color: lane.color, background: lane.bg }}
                >
                  {lane.label}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-medium text-text">{need.title}</h3>
                  <p className="text-[12px] text-text-muted mt-1 leading-relaxed">{need.why}</p>
                  <span className="text-[10px] text-text-muted/60 mt-2 inline-block">
                    {EFFORT_LABEL[need.effort]} · priority {need.priority}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => approve(need)}
                    className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium bg-text text-bg rounded-lg hover:opacity-90 transition-all"
                  >
                    <Check size={13} />
                    Start
                    <ArrowRight size={12} />
                  </button>
                  <button
                    onClick={() => dismiss(need)}
                    className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-[var(--glow-white)] transition-all"
                    title="Dismiss"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {active.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-[14px] text-text">All caught up.</p>
            <p className="text-[12px] text-text-muted mt-1">
              ARC will surface the next set of needs as the business moves.
            </p>
          </div>
        )}
      </div>

      {/* Approved (in motion) */}
      {approved.length > 0 && (
        <div>
          <h2 className="text-[13px] font-medium text-text-muted mb-3">In motion ({approved.length})</h2>
          <div className="space-y-2">
            {approved.map((need) => {
              const lane = LANE_META[need.lane];
              return (
                <div key={need.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[var(--border)]">
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded shrink-0" style={{ color: lane.color, background: lane.bg }}>
                    {lane.label}
                  </span>
                  <span className="text-[13px] text-text-muted line-through flex-1 min-w-0 truncate">{need.title}</span>
                  <Check size={14} className="text-accent-green shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
