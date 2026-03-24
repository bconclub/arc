"use client";

import { useState } from "react";
import { Plus, X, ExternalLink, Pause, Play, Rss } from "lucide-react";
import { ListeningFeed, FeedType, FeedStatus, FEED_TYPES } from "@/types/connections";

interface ListeningFeedsProps {
  feeds: ListeningFeed[];
  onUpdate: (feeds: ListeningFeed[]) => void;
}

const TYPE_STYLES: Record<FeedType, { text: string; bg: string }> = {
  "Social Hashtag": { text: "var(--accent-blue)", bg: "rgba(59,130,246,0.1)" },
  Forum: { text: "var(--accent-green)", bg: "rgba(0,212,170,0.1)" },
  Marketplace: { text: "var(--accent-orange)", bg: "rgba(245,158,11,0.1)" },
  "News Alert": { text: "var(--text)", bg: "rgba(237,237,237,0.08)" },
  Competitor: { text: "var(--accent-red)", bg: "rgba(255,68,68,0.1)" },
};

const emptyForm = {
  name: "",
  type: "Social Hashtag" as FeedType,
  url: "",
  notes: "",
};

export function ListeningFeeds({ feeds, onUpdate }: ListeningFeedsProps) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const addFeed = () => {
    if (!form.name.trim()) return;
    const feed: ListeningFeed = {
      id: Date.now().toString(36),
      name: form.name.trim(),
      type: form.type,
      url: form.url.trim(),
      status: "Active",
      notes: form.notes.trim(),
    };
    onUpdate([...feeds, feed]);
    setForm(emptyForm);
    setAdding(false);
  };

  const toggleStatus = (id: string) => {
    onUpdate(
      feeds.map((f) =>
        f.id === id
          ? { ...f, status: (f.status === "Active" ? "Paused" : "Active") as FeedStatus }
          : f
      )
    );
  };

  const updateNotes = (id: string, notes: string) => {
    onUpdate(feeds.map((f) => (f.id === id ? { ...f, notes } : f)));
  };

  const removeFeed = (id: string) => {
    onUpdate(feeds.filter((f) => f.id !== id));
  };

  const activeCount = feeds.filter((f) => f.status === "Active").length;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-[13px] font-medium text-text tracking-tight">Listening Feeds</h3>
          <span className="text-[10px] text-text-muted font-mono tracking-tight">
            {activeCount} active
          </span>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-all duration-150 px-3 py-1.5 rounded-lg hover:bg-white/[0.04]"
          >
            <Plus size={14} />
            Add Feed
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-5 p-4 bg-bg/50 rounded-xl border border-[rgba(255,255,255,0.06)] space-y-3 animate-dropdown">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1.5 font-medium">Source Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder='e.g. "LinkedIn #solofounder"'
                className="w-full bg-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 transition-all"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1.5 font-medium">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as FeedType }))}
                className="w-full bg-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-text transition-all"
              >
                {FEED_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1.5 font-medium">URL (optional)</label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
                className="w-full bg-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 transition-all"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1.5 font-medium">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="What signals are you tracking here?"
                className="w-full bg-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={addFeed}
              disabled={!form.name.trim()}
              className="btn-primary px-4 py-2 text-xs font-medium bg-white text-black rounded-lg hover:bg-white/90 disabled:opacity-30"
            >
              Add Feed
            </button>
            <button onClick={() => { setForm(emptyForm); setAdding(false); }} className="p-2 rounded-lg hover:bg-white/[0.04] text-text-muted hover:text-text transition-all duration-150">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {feeds.length === 0 && !adding ? (
        <div className="py-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/[0.03] mb-4">
            <Rss size={20} className="text-text-muted/50" />
          </div>
          <p className="text-sm text-text-muted mb-1">No listening feeds</p>
          <p className="text-xs text-text-muted/60 mb-4">Add sources to monitor for content ideas and outreach opportunities</p>
          <button
            onClick={() => setAdding(true)}
            className="btn-primary px-4 py-2 text-xs font-medium bg-white text-black rounded-lg hover:bg-white/90"
          >
            Add First Feed
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {feeds.map((feed) => {
            const typeStyle = TYPE_STYLES[feed.type];
            const isPaused = feed.status === "Paused";
            return (
              <div
                key={feed.id}
                className={`bg-bg/50 rounded-xl border border-[rgba(255,255,255,0.05)] p-4 transition-all duration-200 hover:border-[rgba(255,255,255,0.08)] ${
                  isPaused ? "opacity-45" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-medium text-text">{feed.name}</span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: typeStyle.bg, color: typeStyle.text }}
                      >
                        {feed.type}
                      </span>
                      {isPaused && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-text-muted font-medium">
                          Paused
                        </span>
                      )}
                      {feed.url && (
                        <a
                          href={feed.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-muted hover:text-text transition-all duration-150"
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    {editingId === feed.id ? (
                      <textarea
                        defaultValue={feed.notes}
                        rows={2}
                        className="w-full mt-2 bg-surface border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-xs text-text resize-y transition-all"
                        autoFocus
                        onBlur={(e) => {
                          updateNotes(feed.id, e.target.value);
                          setEditingId(null);
                        }}
                      />
                    ) : (
                      <p
                        onClick={() => setEditingId(feed.id)}
                        className="text-xs text-text-muted mt-2 leading-relaxed cursor-pointer hover:text-text transition-all duration-150"
                      >
                        {feed.notes || "Click to add notes..."}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleStatus(feed.id)}
                      className={`p-2 rounded-lg transition-all duration-150 ${
                        isPaused
                          ? "text-accent-green hover:bg-accent-green/10"
                          : "text-text-muted hover:bg-white/[0.04] hover:text-accent-orange"
                      }`}
                      title={isPaused ? "Resume" : "Pause"}
                    >
                      {isPaused ? <Play size={14} /> : <Pause size={14} />}
                    </button>
                    <button
                      onClick={() => removeFeed(feed.id)}
                      className="p-2 rounded-lg text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-all duration-150"
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
