"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { Pencil, Check, X, TrendingUp, TrendingDown } from "lucide-react";
import { ChannelMetrics, MetricHistory } from "@/types/overview";
import { Sparkline } from "./Sparkline";

function parseTrendNumber(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]/g, "")) || 0;
}

function TrendArrow({ current, previous }: { current: string; previous?: string }) {
  if (!previous) return null;
  const curr = parseTrendNumber(current);
  const prev = parseTrendNumber(previous);
  if (curr === prev) return null;
  const up = curr > prev;
  return (
    <span className={`inline-flex items-center ml-1.5 ${up ? "text-accent-green" : "text-accent-red"}`}>
      {up ? <TrendingUp size={13} strokeWidth={2.2} /> : <TrendingDown size={13} strokeWidth={2.2} />}
    </span>
  );
}

function FlashNumber({ value, prev }: { value: string; prev?: string }) {
  const [flash, setFlash] = useState("");
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current !== value && prev !== undefined) {
      const curr = parseTrendNumber(value);
      const old = parseTrendNumber(prev);
      if (curr !== old) {
        setFlash(curr > old ? "flash-green" : "flash-red");
        const t = setTimeout(() => setFlash(""), 800);
        return () => clearTimeout(t);
      }
    }
    prevRef.current = value;
  }, [value, prev]);

  return (
    <span className={`text-2xl font-bold font-mono text-text tracking-tighter ${flash}`}>
      {value}
    </span>
  );
}

interface MetricCardProps {
  title: string;
  icon: ReactNode;
  metrics: ChannelMetrics;
  onSave: (updated: ChannelMetrics, history: MetricHistory[]) => void;
  storageKey: string;
  sparklineData?: number[];
}

export function MetricCard({ title, icon, metrics, onSave, storageKey, sparklineData }: MetricCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const startEdit = () => {
    const d: Record<string, string> = {};
    Object.entries(metrics).forEach(([k, m]) => {
      d[k] = m.value;
    });
    setDraft(d);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDraft({});
  };

  const save = () => {
    const updated: ChannelMetrics = {};
    const history: MetricHistory[] = [];

    Object.entries(metrics).forEach(([key, metric]) => {
      const newVal = draft[key] ?? metric.value;
      if (newVal !== metric.value) {
        history.push({
          key,
          channel: storageKey,
          oldValue: metric.value,
          newValue: newVal,
          timestamp: new Date().toISOString(),
        });
      }
      updated[key] = {
        label: metric.label,
        value: newVal,
        prev: newVal !== metric.value ? metric.value : metric.prev,
      };
    });

    onSave(updated, history);
    setEditing(false);
    setDraft({});
  };

  return (
    <div className="metric-card card p-6 group">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="text-text-muted/60">{icon}</span>
          <h3 className="text-[13px] font-medium text-text tracking-tight">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {sparklineData && (
            <div className="opacity-40 group-hover:opacity-80 transition-opacity duration-300">
              <Sparkline data={sparklineData} width={72} height={22} />
            </div>
          )}
          {!editing ? (
            <button
              onClick={startEdit}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded-lg hover:bg-white/[0.06] text-text-muted hover:text-text"
            >
              <Pencil size={13} />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={save} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-accent-green">
                <Check size={14} />
              </button>
              <button onClick={cancel} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-accent-red">
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
        {Object.entries(metrics).map(([key, metric]) => (
          <div key={key}>
            {editing ? (
              <input
                type="text"
                value={draft[key] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                className="w-full bg-bg border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-lg font-mono font-bold text-text transition-all"
              />
            ) : (
              <div className="flex items-baseline">
                <FlashNumber value={metric.value} prev={metric.prev} />
                <TrendArrow current={metric.value} previous={metric.prev} />
              </div>
            )}
            <p className="text-[11px] text-text-muted mt-1.5 tracking-wide">{metric.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
