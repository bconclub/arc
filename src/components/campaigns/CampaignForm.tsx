"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  Campaign,
  CampaignStatus,
  CAMPAIGN_STATUSES,
  PILLARS,
  Pillar,
  PLATFORMS,
  Platform,
} from "@/types/content";

interface CampaignFormProps {
  onSave: (campaign: Campaign) => void;
  onCancel: () => void;
  initial?: Campaign;
}

export function CampaignForm({ onSave, onCancel, initial }: CampaignFormProps) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    goal: initial?.goal ?? "",
    startDate: initial?.startDate ?? today,
    endDate: initial?.endDate ?? "",
    platforms: initial?.platforms ?? ["LinkedIn" as Platform],
    pillar: initial?.pillar ?? ("All" as Pillar | "All"),
    status: initial?.status ?? ("Planning" as CampaignStatus),
  });

  const togglePlatform = (p: Platform) => {
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(p)
        ? f.platforms.filter((x) => x !== p)
        : [...f.platforms, p],
    }));
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.goal.trim()) return;
    onSave({
      id: initial?.id ?? Date.now().toString(36),
      name: form.name.trim(),
      goal: form.goal.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      platforms: form.platforms,
      pillar: form.pillar,
      status: form.status,
      performanceNotes: initial?.performanceNotes ?? "",
      metrics: initial?.metrics ?? {
        impressions: "0",
        engagement: "0",
        dmsReceived: "0",
        demosBooked: "0",
      },
    });
  };

  return (
    <div className="p-5 bg-bg rounded-lg border border-border space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text">
          {initial ? "Edit Campaign" : "Create Campaign"}
        </h3>
        <button onClick={onCancel} className="p-1.5 rounded-md hover:bg-white/5 text-text-muted hover:text-text">
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs text-text-muted block mb-1">Campaign Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. WhatsApp Lead Gen Sprint"
            className="w-full bg-surface border border-border rounded-md px-2.5 py-1.5 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:border-text-muted"
            autoFocus
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-text-muted block mb-1">Goal</label>
          <input
            type="text"
            value={form.goal}
            onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
            placeholder="e.g. Book 10 demos, Get 500 followers"
            className="w-full bg-surface border border-border rounded-md px-2.5 py-1.5 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:border-text-muted"
          />
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Start Date</label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            className="w-full bg-surface border border-border rounded-md px-2.5 py-1.5 text-sm text-text focus:outline-none focus:border-text-muted"
          />
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">End Date</label>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            className="w-full bg-surface border border-border rounded-md px-2.5 py-1.5 text-sm text-text focus:outline-none focus:border-text-muted"
          />
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Content Pillar</label>
          <select
            value={form.pillar}
            onChange={(e) => setForm((f) => ({ ...f, pillar: e.target.value as Pillar | "All" }))}
            className="w-full bg-surface border border-border rounded-md px-2.5 py-1.5 text-sm text-text focus:outline-none focus:border-text-muted"
          >
            <option value="All">All Pillars</option>
            {PILLARS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CampaignStatus }))}
            className="w-full bg-surface border border-border rounded-md px-2.5 py-1.5 text-sm text-text focus:outline-none focus:border-text-muted"
          >
            {CAMPAIGN_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Platform multi-select */}
      <div>
        <label className="text-xs text-text-muted block mb-2">Target Platforms</label>
        <div className="flex items-center gap-2 flex-wrap">
          {PLATFORMS.filter((p) => p !== "All").map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePlatform(p)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                form.platforms.includes(p)
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-border text-text-muted hover:text-text hover:bg-white/5"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!form.name.trim() || !form.goal.trim()}
          className="px-4 py-1.5 text-xs font-medium bg-white text-black rounded-md hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {initial ? "Save Changes" : "Create Campaign"}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-text-muted hover:text-text transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
