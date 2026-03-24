"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, X, Pencil, Check } from "lucide-react";
import {
  Campaign,
  Topic,
  CAMPAIGN_STATUS_COLORS,
  PILLAR_COLORS,
  PILLAR_BG,
  PILLARS,
  Pillar,
  PLATFORMS,
  Platform,
} from "@/types/content";

interface CampaignCardProps {
  campaign: Campaign;
  topics: Topic[];
  allTopics: Topic[];
  onUpdateCampaign: (campaign: Campaign) => void;
  onLinkTopic: (topicId: string, campaignId: string) => void;
  onAddTopic: (topic: Topic) => void;
}

export function CampaignCard({
  campaign,
  topics,
  allTopics,
  onUpdateCampaign,
  onLinkTopic,
  onAddTopic,
}: CampaignCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [addingContent, setAddingContent] = useState(false);
  const [linkMode, setLinkMode] = useState<"existing" | "new">("existing");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [newTopicForm, setNewTopicForm] = useState({ title: "", pillar: PILLARS[0] as Pillar, platform: "LinkedIn" as Platform });
  const [editingMetrics, setEditingMetrics] = useState(false);
  const [metricsDraft, setMetricsDraft] = useState(campaign.metrics);
  const [editingNotes, setEditingNotes] = useState(false);

  const statusStyle = CAMPAIGN_STATUS_COLORS[campaign.status];
  const publishedCount = topics.filter((t) => t.status === "published").length;
  const totalCount = topics.length;

  const unlinkedTopics = allTopics.filter(
    (t) => !t.campaignId && (t.status === "idea" || t.status === "scheduled")
  );

  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleLinkExisting = () => {
    if (!selectedTopicId) return;
    onLinkTopic(selectedTopicId, campaign.id);
    setSelectedTopicId("");
    setAddingContent(false);
  };

  const handleAddNew = () => {
    if (!newTopicForm.title.trim()) return;
    const topic: Topic = {
      id: Date.now().toString(36),
      title: newTopicForm.title.trim(),
      pillar: newTopicForm.pillar,
      status: "idea",
      platform: newTopicForm.platform,
      campaignId: campaign.id,
    };
    onAddTopic(topic);
    setNewTopicForm({ title: "", pillar: PILLARS[0], platform: "LinkedIn" });
    setAddingContent(false);
  };

  const saveMetrics = () => {
    onUpdateCampaign({ ...campaign, metrics: metricsDraft });
    setEditingMetrics(false);
  };

  const saveNotes = (notes: string) => {
    onUpdateCampaign({ ...campaign, performanceNotes: notes });
  };

  return (
    <div className="border border-border bg-surface rounded-xl overflow-hidden hover:bg-surface-hover/30 transition-colors">
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <h3 className="text-sm font-medium text-text truncate">{campaign.name}</h3>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
              style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
            >
              {campaign.status}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span className="font-mono">
              {formatDate(campaign.startDate)} — {formatDate(campaign.endDate)}
            </span>
            <span className="truncate">{campaign.goal}</span>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="text-xs font-mono text-text">
              {publishedCount}/{totalCount}
            </span>
            <span className="text-[10px] text-text-muted block">posted</span>
          </div>
          <div className="w-16 h-1.5 bg-bg rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: totalCount > 0 ? `${(publishedCount / totalCount) * 100}%` : "0%",
                backgroundColor: statusStyle.text,
              }}
            />
          </div>
          {expanded ? (
            <ChevronUp size={16} className="text-text-muted" />
          ) : (
            <ChevronDown size={16} className="text-text-muted" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border/50">
          {/* Content pieces */}
          <div className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Content Pieces</span>
              {!addingContent && (
                <button
                  onClick={() => setAddingContent(true)}
                  className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors px-2 py-1 rounded-md hover:bg-white/5"
                >
                  <Plus size={12} />
                  Add Content
                </button>
              )}
            </div>

            {/* Add content form */}
            {addingContent && (
              <div className="mb-3 p-3 bg-bg rounded-lg border border-border space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setLinkMode("existing")}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                      linkMode === "existing" ? "bg-white/10 text-white" : "text-text-muted hover:text-text"
                    }`}
                  >
                    Link Existing
                  </button>
                  <button
                    onClick={() => setLinkMode("new")}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                      linkMode === "new" ? "bg-white/10 text-white" : "text-text-muted hover:text-text"
                    }`}
                  >
                    Create New
                  </button>
                </div>

                {linkMode === "existing" ? (
                  <div className="space-y-2">
                    <select
                      value={selectedTopicId}
                      onChange={(e) => setSelectedTopicId(e.target.value)}
                      className="w-full bg-surface border border-border rounded-md px-2.5 py-1.5 text-sm text-text focus:outline-none focus:border-text-muted"
                    >
                      <option value="">Select a topic...</option>
                      {unlinkedTopics.map((t) => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleLinkExisting}
                        disabled={!selectedTopicId}
                        className="px-3 py-1.5 text-xs font-medium bg-white text-black rounded-md hover:bg-white/90 transition-colors disabled:opacity-30"
                      >
                        Link
                      </button>
                      <button onClick={() => setAddingContent(false)} className="p-1.5 rounded-md hover:bg-white/5 text-text-muted">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Topic title..."
                      value={newTopicForm.title}
                      onChange={(e) => setNewTopicForm((f) => ({ ...f, title: e.target.value }))}
                      className="w-full bg-surface border border-border rounded-md px-2.5 py-1.5 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:border-text-muted"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newTopicForm.pillar}
                        onChange={(e) => setNewTopicForm((f) => ({ ...f, pillar: e.target.value as Pillar }))}
                        className="bg-surface border border-border rounded-md px-2.5 py-1.5 text-sm text-text focus:outline-none"
                      >
                        {PILLARS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <select
                        value={newTopicForm.platform}
                        onChange={(e) => setNewTopicForm((f) => ({ ...f, platform: e.target.value as Platform }))}
                        className="bg-surface border border-border rounded-md px-2.5 py-1.5 text-sm text-text focus:outline-none"
                      >
                        {PLATFORMS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAddNew}
                        disabled={!newTopicForm.title.trim()}
                        className="px-3 py-1.5 text-xs font-medium bg-white text-black rounded-md hover:bg-white/90 transition-colors disabled:opacity-30"
                      >
                        Add
                      </button>
                      <button onClick={() => setAddingContent(false)} className="p-1.5 rounded-md hover:bg-white/5 text-text-muted">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Topic list */}
            {topics.length === 0 ? (
              <p className="text-xs text-text-muted py-2">No content linked yet.</p>
            ) : (
              <div className="space-y-1.5">
                {topics.map((topic) => (
                  <div key={topic.id} className="flex items-center gap-3 px-3 py-2 bg-bg rounded-lg">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: PILLAR_COLORS[topic.pillar] }}
                    />
                    <span className="text-xs text-text flex-1 truncate">{topic.title}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: PILLAR_BG[topic.pillar], color: PILLAR_COLORS[topic.pillar] }}
                    >
                      {topic.pillar}
                    </span>
                    <span className="text-[10px] text-text-muted">{topic.platform}</span>
                    <span className={`text-[10px] font-medium uppercase tracking-wider ${
                      topic.status === "published" ? "text-accent-green" : "text-text-muted"
                    }`}>
                      {topic.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Performance Notes */}
          <div>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-2">
              Performance Notes
            </span>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  defaultValue={campaign.performanceNotes}
                  rows={3}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:border-text-muted resize-y"
                  placeholder="Log what's working and what's not..."
                  autoFocus
                  onBlur={(e) => {
                    saveNotes(e.target.value);
                    setEditingNotes(false);
                  }}
                />
              </div>
            ) : (
              <div
                onClick={() => setEditingNotes(true)}
                className="bg-bg rounded-lg px-3 py-2 text-sm text-text-muted cursor-pointer hover:text-text transition-colors min-h-[40px]"
              >
                {campaign.performanceNotes || "Click to add notes..."}
              </div>
            )}
          </div>

          {/* Mini metrics */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Campaign Metrics
              </span>
              {!editingMetrics ? (
                <button
                  onClick={() => { setMetricsDraft(campaign.metrics); setEditingMetrics(true); }}
                  className="p-1 rounded-md hover:bg-white/5 text-text-muted hover:text-text transition-colors"
                >
                  <Pencil size={12} />
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button onClick={saveMetrics} className="p-1 rounded-md hover:bg-white/5 text-accent-green">
                    <Check size={12} />
                  </button>
                  <button onClick={() => setEditingMetrics(false)} className="p-1 rounded-md hover:bg-white/5 text-accent-red">
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                { key: "impressions" as const, label: "Impressions" },
                { key: "engagement" as const, label: "Engagement" },
                { key: "dmsReceived" as const, label: "DMs Received" },
                { key: "demosBooked" as const, label: "Demos Booked" },
              ]).map(({ key, label }) => (
                <div key={key} className="bg-bg rounded-lg p-3">
                  {editingMetrics ? (
                    <input
                      type="text"
                      value={metricsDraft[key]}
                      onChange={(e) => setMetricsDraft((m) => ({ ...m, [key]: e.target.value }))}
                      className="w-full bg-surface border border-border rounded px-2 py-1 text-lg font-mono font-bold text-text focus:outline-none focus:border-text-muted"
                    />
                  ) : (
                    <span className="text-lg font-bold font-mono text-text">{campaign.metrics[key]}</span>
                  )}
                  <p className="text-[10px] text-text-muted mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
