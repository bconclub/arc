"use client";

import { useState } from "react";
import { Plus, X, GripVertical, Lightbulb } from "lucide-react";
import {
  Topic,
  Campaign,
  PILLARS,
  Pillar,
  PILLAR_COLORS,
  PILLAR_BG,
  STATUSES,
  TopicStatus,
  PLATFORMS,
  Platform,
} from "@/types/content";

interface TopicBankProps {
  topics: Topic[];
  onUpdate: (topics: Topic[]) => void;
  campaigns?: Campaign[];
}

const STATUS_LABELS: Record<TopicStatus, string> = {
  idea: "Idea",
  scheduled: "Scheduled",
  published: "Published",
  repurposed: "Repurposed",
};

export function TopicBank({ topics, onUpdate, campaigns = [] }: TopicBankProps) {
  const [activePillar, setActivePillar] = useState<Pillar | "All">("All");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", pillar: PILLARS[0] as Pillar, platform: "All" as Platform, campaignId: "" });
  const [dragId, setDragId] = useState<string | null>(null);

  const activeCampaigns = campaigns.filter((c) => c.status === "Active" || c.status === "Planning");
  const filtered = activePillar === "All" ? topics : topics.filter((t) => t.pillar === activePillar);

  const grouped = STATUSES.reduce((acc, status) => {
    acc[status] = filtered.filter((t) => t.status === status);
    return acc;
  }, {} as Record<TopicStatus, Topic[]>);

  const addTopic = () => {
    if (!form.title.trim()) return;
    const newTopic: Topic = {
      id: Date.now().toString(36),
      title: form.title.trim(),
      pillar: form.pillar,
      status: "idea",
      platform: form.platform,
      campaignId: form.campaignId || undefined,
    };
    onUpdate([...topics, newTopic]);
    setForm({ title: "", pillar: PILLARS[0], platform: "All", campaignId: "" });
    setAdding(false);
  };

  const handleDragStart = (id: string) => {
    setDragId(id);
  };

  const handleDrop = (status: TopicStatus) => {
    if (!dragId) return;
    const updated = topics.map((t) => (t.id === dragId ? { ...t, status } : t));
    onUpdate(updated);
    setDragId(null);
  };

  const getCampaignName = (id?: string) => {
    if (!id) return null;
    return campaigns.find((c) => c.id === id)?.name;
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[13px] font-medium text-text tracking-tight">Topic Bank</h3>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-all duration-150 px-3 py-1.5 rounded-lg hover:bg-white/[0.04]"
          >
            <Plus size={14} />
            Add Topic
          </button>
        )}
      </div>

      {/* Pillar filter tabs */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
        <button
          onClick={() => setActivePillar("All")}
          className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-all duration-200 ${
            activePillar === "All"
              ? "bg-white text-black font-medium"
              : "text-text-muted hover:text-text hover:bg-white/[0.04]"
          }`}
        >
          All
        </button>
        {PILLARS.map((p) => (
          <button
            key={p}
            onClick={() => setActivePillar(p)}
            className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-all duration-200 ${
              activePillar === p
                ? "text-white font-medium"
                : "text-text-muted hover:text-text hover:bg-white/[0.04]"
            }`}
            style={
              activePillar === p
                ? { backgroundColor: PILLAR_BG[p], color: PILLAR_COLORS[p] }
                : undefined
            }
          >
            {p}
          </button>
        ))}
      </div>

      {/* Add topic form */}
      {adding && (
        <div className="mb-5 p-4 bg-bg/50 rounded-xl border border-[rgba(255,255,255,0.06)] space-y-3">
          <input
            type="text"
            placeholder="Topic idea..."
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full bg-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 transition-all"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && addTopic()}
          />
          <div className={`grid gap-3 ${activeCampaigns.length > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1.5 font-medium">Pillar</label>
              <select
                value={form.pillar}
                onChange={(e) => setForm((f) => ({ ...f, pillar: e.target.value as Pillar }))}
                className="w-full bg-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-text transition-all"
              >
                {PILLARS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1.5 font-medium">Platform</label>
              <select
                value={form.platform}
                onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value as Platform }))}
                className="w-full bg-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-text transition-all"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            {activeCampaigns.length > 0 && (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1.5 font-medium">Campaign</label>
                <select
                  value={form.campaignId}
                  onChange={(e) => setForm((f) => ({ ...f, campaignId: e.target.value }))}
                  className="w-full bg-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-text transition-all"
                >
                  <option value="">None</option>
                  {activeCampaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={addTopic} className="btn-primary px-4 py-2 text-xs font-medium bg-white text-black rounded-lg hover:bg-white/90">
              Add
            </button>
            <button onClick={() => setAdding(false)} className="p-2 rounded-lg hover:bg-white/[0.04] text-text-muted hover:text-text transition-all duration-150">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Status columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATUSES.map((status) => (
          <div
            key={status}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-1", "ring-white/10"); }}
            onDragLeave={(e) => { e.currentTarget.classList.remove("ring-1", "ring-white/10"); }}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("ring-1", "ring-white/10"); handleDrop(status); }}
            className="bg-bg/50 rounded-xl p-3.5 min-h-[120px] transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="section-heading">
                {STATUS_LABELS[status]}
              </span>
              <span className="text-[10px] text-text-muted/50 font-mono">{grouped[status].length}</span>
            </div>

            {grouped[status].length === 0 ? (
              <div className="py-6 text-center">
                <Lightbulb size={16} className="text-text-muted/20 mx-auto mb-2" />
                <p className="text-[10px] text-text-muted/40">No topics</p>
              </div>
            ) : (
              <div className="space-y-2">
                {grouped[status].map((topic) => {
                  const campName = getCampaignName(topic.campaignId);
                  return (
                    <div
                      key={topic.id}
                      draggable
                      onDragStart={() => handleDragStart(topic.id)}
                      onDragEnd={() => setDragId(null)}
                      className={`p-3 bg-surface border border-[rgba(255,255,255,0.05)] rounded-xl cursor-grab active:cursor-grabbing hover:border-[rgba(255,255,255,0.1)] transition-all duration-200 ${
                        dragId === topic.id ? "opacity-40" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical size={14} className="text-text-muted/20 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-text leading-snug">{topic.title}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                              style={{
                                backgroundColor: PILLAR_BG[topic.pillar],
                                color: PILLAR_COLORS[topic.pillar],
                              }}
                            >
                              {topic.pillar}
                            </span>
                            <span className="text-[10px] text-text-muted">{topic.platform}</span>
                            {campName && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.04] text-text-muted">
                                {campName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
