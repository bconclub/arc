"use client";

import { useState } from "react";
import { Plus, X, Check, Sparkles, FileText } from "lucide-react";
import {
  Draft,
  DraftStatus,
  PLATFORMS,
  Platform,
  PILLARS,
  Pillar,
  PILLAR_COLORS,
  PILLAR_BG,
  CalendarEntry,
} from "@/types/content";

interface DraftsProps {
  drafts: Draft[];
  onUpdate: (drafts: Draft[]) => void;
  onPostToCalendar: (entry: CalendarEntry) => void;
  onWriteWithAI?: (draft: Draft) => void;
  aiWriting?: boolean;
}

const STATUS_STYLES: Record<DraftStatus, string> = {
  draft: "text-text-muted",
  ready: "text-accent-blue",
  posted: "text-accent-green",
};

export function Drafts({ drafts, onUpdate, onPostToCalendar, onWriteWithAI, aiWriting }: DraftsProps) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [postDate, setPostDate] = useState(new Date().toISOString().split("T")[0]);
  const [form, setForm] = useState({
    title: "",
    body: "",
    platform: "LinkedIn" as Platform,
    pillar: "Pain Points" as Pillar,
  });

  const addDraft = () => {
    if (!form.title.trim()) return;
    const newDraft: Draft = {
      id: Date.now().toString(36),
      title: form.title.trim(),
      body: form.body,
      platform: form.platform,
      status: "draft",
      createdAt: new Date().toISOString().split("T")[0],
      pillar: form.pillar,
    };
    onUpdate([...drafts, newDraft]);
    setForm({ title: "", body: "", platform: "LinkedIn", pillar: "Pain Points" });
    setAdding(false);
  };

  const updateDraft = (id: string, changes: Partial<Draft>) => {
    onUpdate(drafts.map((d) => (d.id === id ? { ...d, ...changes } : d)));
  };

  const cycleStatus = (draft: Draft) => {
    const order: DraftStatus[] = ["draft", "ready", "posted"];
    const nextIdx = order.indexOf(draft.status) + 1;
    if (nextIdx >= order.length) {
      setPostingId(draft.id);
      return;
    }
    updateDraft(draft.id, { status: order[nextIdx] });
  };

  const confirmPost = (draft: Draft) => {
    updateDraft(draft.id, { status: "posted" });
    onPostToCalendar({
      id: Date.now().toString(36),
      topicId: draft.id,
      topicTitle: draft.title,
      pillar: draft.pillar || "Pain Points",
      platform: draft.platform,
      format: "Text Post",
      day: postDate,
    });
    setPostingId(null);
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[13px] font-medium text-text tracking-tight">Drafts</h3>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-all duration-150 px-3 py-1.5 rounded-lg hover:bg-white/[0.04]"
          >
            <Plus size={14} />
            Add Draft
          </button>
        )}
      </div>

      {/* Add draft form */}
      {adding && (
        <div className="mb-5 p-4 bg-bg/50 rounded-xl border border-[rgba(255,255,255,0.06)] space-y-3 animate-dropdown">
          <input
            type="text"
            placeholder="Draft title..."
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full bg-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 transition-all"
            autoFocus
          />
          <textarea
            placeholder="Write your content..."
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={4}
            className="w-full bg-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 resize-y transition-all"
          />
          <div className="grid grid-cols-2 gap-3">
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
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={addDraft} className="btn-primary px-4 py-2 text-xs font-medium bg-white text-black rounded-lg hover:bg-white/90">
              Save Draft
            </button>
            <button onClick={() => setAdding(false)} className="p-2 rounded-lg hover:bg-white/[0.04] text-text-muted hover:text-text transition-all duration-150">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Drafts list */}
      {drafts.length === 0 && !adding ? (
        <div className="py-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/[0.03] mb-4">
            <FileText size={20} className="text-text-muted/50" />
          </div>
          <p className="text-sm text-text-muted mb-1">No drafts yet</p>
          <p className="text-xs text-text-muted/60 mb-4">Start writing content for your channels</p>
          <button
            onClick={() => setAdding(true)}
            className="btn-primary px-4 py-2 text-xs font-medium bg-white text-black rounded-lg hover:bg-white/90"
          >
            Create First Draft
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {drafts
            .sort((a, b) => {
              const order: DraftStatus[] = ["draft", "ready", "posted"];
              return order.indexOf(a.status) - order.indexOf(b.status);
            })
            .map((draft) => (
              <div key={draft.id} className="bg-bg/50 rounded-xl border border-[rgba(255,255,255,0.05)] overflow-hidden hover:border-[rgba(255,255,255,0.08)] transition-all duration-200">
                <div className="p-4 flex items-start gap-3">
                  {/* Status toggle */}
                  <button
                    onClick={() => cycleStatus(draft)}
                    className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-200 ${
                      draft.status === "posted"
                        ? "border-accent-green bg-accent-green/20"
                        : draft.status === "ready"
                        ? "border-accent-blue bg-accent-blue/20"
                        : "border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)]"
                    }`}
                  >
                    {draft.status === "posted" && <Check size={10} className="text-accent-green" />}
                    {draft.status === "ready" && <Check size={10} className="text-accent-blue" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-medium text-text">{draft.title}</span>
                      {draft.pillar && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: PILLAR_BG[draft.pillar], color: PILLAR_COLORS[draft.pillar] }}
                        >
                          {draft.pillar}
                        </span>
                      )}
                    </div>

                    {/* Inline body editing */}
                    {editingId === draft.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={draft.body}
                          onChange={(e) => updateDraft(draft.id, { body: e.target.value })}
                          rows={4}
                          className="w-full bg-surface border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 text-sm text-text resize-y transition-all"
                        />
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 text-xs text-text-muted hover:text-text bg-surface rounded-lg hover:bg-surface-hover transition-all duration-150"
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <p
                        onClick={() => setEditingId(draft.id)}
                        className="text-xs text-text-muted leading-relaxed cursor-pointer hover:text-text transition-all duration-150 line-clamp-2"
                      >
                        {draft.body || "Click to add content..."}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2.5">
                      <span className="text-[10px] text-text-muted">{draft.platform}</span>
                      <span className={`text-[10px] font-medium uppercase tracking-wider ${STATUS_STYLES[draft.status]}`}>
                        {draft.status}
                      </span>
                      <span className="text-[10px] text-text-muted/40 font-mono tracking-tight">{draft.createdAt}</span>
                      {onWriteWithAI && draft.status === "draft" && (
                        <button
                          onClick={() => onWriteWithAI(draft)}
                          disabled={aiWriting}
                          className={`inline-flex items-center gap-1 text-[10px] text-accent-blue hover:text-accent-blue/80 transition-all duration-150 ${aiWriting ? "opacity-50 animate-pulse" : ""}`}
                        >
                          <Sparkles size={10} />
                          Write with AI
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Post date picker */}
                {postingId === draft.id && (
                  <div className="px-4 pb-4 flex items-center gap-2 border-t border-[rgba(255,255,255,0.04)] pt-3 mt-1 animate-dropdown">
                    <span className="text-xs text-text-muted">Posted on:</span>
                    <input
                      type="date"
                      value={postDate}
                      onChange={(e) => setPostDate(e.target.value)}
                      className="bg-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-2.5 py-1.5 text-xs text-text transition-all"
                    />
                    <button
                      onClick={() => confirmPost(draft)}
                      className="btn-primary px-3 py-1.5 text-xs font-medium bg-white text-black rounded-lg hover:bg-white/90"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setPostingId(null)}
                      className="p-1.5 rounded-lg hover:bg-white/[0.04] text-text-muted transition-all duration-150"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
