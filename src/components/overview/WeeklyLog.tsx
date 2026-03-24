"use client";

import { useState } from "react";
import { Plus, X, ClipboardList } from "lucide-react";
import { WeeklyLogEntry, CHANNELS } from "@/types/overview";

interface WeeklyLogProps {
  entries: WeeklyLogEntry[];
  onAdd: (entry: WeeklyLogEntry) => void;
}

const emptyForm = {
  date: new Date().toISOString().split("T")[0],
  channel: "LinkedIn" as string,
  action: "",
  result: "",
  notes: "",
};

export function WeeklyLog({ entries, onAdd }: WeeklyLogProps) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const submit = () => {
    if (!form.action.trim()) return;
    onAdd({
      id: Date.now().toString(36),
      ...form,
    });
    setForm(emptyForm);
    setAdding(false);
  };

  const cancel = () => {
    setForm(emptyForm);
    setAdding(false);
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[13px] font-medium text-text tracking-tight">Weekly Log</h3>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-all duration-150 px-3 py-1.5 rounded-lg hover:bg-white/[0.04]"
          >
            <Plus size={14} />
            Add Entry
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-5 p-4 bg-bg/50 rounded-xl border border-[rgba(255,255,255,0.06)] space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1.5 font-medium">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full bg-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-text transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1.5 font-medium">Channel</label>
              <select
                value={form.channel}
                onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                className="w-full bg-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-text transition-all"
              >
                {CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1.5 font-medium">Action</label>
              <input
                type="text"
                placeholder="What did you do?"
                value={form.action}
                onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
                className="w-full bg-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted/40 transition-all"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1.5 font-medium">Result</label>
              <input
                type="text"
                placeholder="What happened?"
                value={form.result}
                onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))}
                className="w-full bg-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted/40 transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1.5 font-medium">Notes</label>
              <input
                type="text"
                placeholder="Optional notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full bg-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted/40 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={submit}
              className="btn-primary px-4 py-2 text-xs font-medium bg-white text-black rounded-lg hover:bg-white/90"
            >
              Save
            </button>
            <button
              onClick={cancel}
              className="p-2 rounded-lg hover:bg-white/[0.04] text-text-muted hover:text-text transition-all duration-150"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 && !adding ? (
        <div className="py-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/[0.03] mb-4">
            <ClipboardList size={20} className="text-text-muted/50" />
          </div>
          <p className="text-sm text-text-muted mb-1">No entries yet</p>
          <p className="text-xs text-text-muted/60 mb-4">Start logging your weekly activity to track progress</p>
          <button
            onClick={() => setAdding(true)}
            className="btn-primary px-4 py-2 text-xs font-medium bg-white text-black rounded-lg hover:bg-white/90"
          >
            Add First Entry
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="pb-3 pr-6 text-[10px] uppercase tracking-widest text-text-muted font-medium">Date</th>
                <th className="pb-3 pr-6 text-[10px] uppercase tracking-widest text-text-muted font-medium">Channel</th>
                <th className="pb-3 pr-6 text-[10px] uppercase tracking-widest text-text-muted font-medium">Action</th>
                <th className="pb-3 pr-6 text-[10px] uppercase tracking-widest text-text-muted font-medium">Result</th>
                <th className="pb-3 text-[10px] uppercase tracking-widest text-text-muted font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {entries
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((entry) => (
                  <tr
                    key={entry.id}
                    className="table-row-alt transition-colors duration-150"
                  >
                    <td className="py-3 pr-6 font-mono text-xs text-text-muted whitespace-nowrap">
                      {entry.date}
                    </td>
                    <td className="py-3 pr-6 text-[13px] whitespace-nowrap">{entry.channel}</td>
                    <td className="py-3 pr-6 text-[13px]">{entry.action}</td>
                    <td className="py-3 pr-6 text-[13px] text-text-muted">{entry.result}</td>
                    <td className="py-3 text-[13px] text-text-muted">{entry.notes}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
