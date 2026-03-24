"use client";

import { useEffect, useState } from "react";
import {
  Briefcase,
  Camera,
  AtSign,
  MessageCircle,
  Calendar,
  BarChart3,
  Info,
} from "lucide-react";
import { ConnectedSource, ConnectionStatus } from "@/types/connections";

interface ConnectedSourcesProps {
  sources: ConnectedSource[];
  onUpdate: (sources: ConnectedSource[]) => void;
}

const ICONS: Record<string, React.ReactNode> = {
  linkedin: <Briefcase size={18} strokeWidth={1.5} />,
  instagram: <Camera size={18} strokeWidth={1.5} />,
  twitter: <AtSign size={18} strokeWidth={1.5} />,
  whatsapp: <MessageCircle size={18} strokeWidth={1.5} />,
  gcal: <Calendar size={18} strokeWidth={1.5} />,
  ga: <BarChart3 size={18} strokeWidth={1.5} />,
};

const STATUS_STYLE: Record<ConnectionStatus, { text: string; bg: string; dot: string }> = {
  Connected: { text: "text-accent-green", bg: "rgba(0,212,170,0.1)", dot: "bg-accent-green" },
  "Not Connected": { text: "text-text-muted", bg: "rgba(136,136,136,0.1)", dot: "bg-text-muted" },
  Error: { text: "text-accent-red", bg: "rgba(255,68,68,0.1)", dot: "bg-accent-red" },
};

function countDataPoints(prefix: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(prefix);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return Object.keys(parsed).length;
    }
    if (Array.isArray(parsed)) return parsed.length;
    return 0;
  } catch {
    return 0;
  }
}

export function ConnectedSources({ sources, onUpdate }: ConnectedSourcesProps) {
  const [dataCounts, setDataCounts] = useState<Record<string, number>>({});
  const [tooltip, setTooltip] = useState<string | null>(null);

  useEffect(() => {
    const counts: Record<string, number> = {};
    sources.forEach((s) => {
      counts[s.id] = countDataPoints(s.storageKeyPrefix);
    });
    setDataCounts(counts);
  }, [sources]);

  const toggleConnection = (id: string) => {
    onUpdate(
      sources.map((s) => {
        if (s.id !== id) return s;
        const newStatus: ConnectionStatus =
          s.status === "Connected" ? "Not Connected" : "Connected";
        return {
          ...s,
          status: newStatus,
          lastSync: newStatus === "Connected" ? new Date().toISOString() : null,
        };
      })
    );
  };

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-6">
        <h3 className="text-[13px] font-medium text-text tracking-tight">Connected Sources</h3>
        <div className="relative">
          <button
            onMouseEnter={() => setTooltip("info")}
            onMouseLeave={() => setTooltip(null)}
            className="p-1 text-text-muted/40 hover:text-text-muted transition-all duration-150"
          >
            <Info size={13} />
          </button>
          {tooltip === "info" && (
            <div className="absolute left-6 -top-1 z-10 w-56 p-3 bg-surface border border-[rgba(255,255,255,0.08)] rounded-xl text-[11px] text-text-muted leading-relaxed shadow-xl animate-dropdown">
              All data is currently manual input via localStorage. API integrations for live syncing are coming in a future update.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {sources.map((source) => {
          const style = STATUS_STYLE[source.status];
          const count = dataCounts[source.id] ?? 0;
          return (
            <div
              key={source.id}
              className="bg-bg/50 border border-[rgba(255,255,255,0.05)] rounded-xl p-5 hover:border-[rgba(255,255,255,0.1)] transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center text-text-muted">
                    {ICONS[source.id]}
                  </div>
                  <div>
                    <h4 className="text-[13px] font-medium text-text">{source.name}</h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                      <span className={`text-[10px] font-medium ${style.text}`}>
                        {source.status === "Connected" ? "Manual Input" : source.status}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toggleConnection(source.id)}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-all duration-200 ${
                    source.status === "Connected"
                      ? "border-[rgba(255,255,255,0.06)] text-text-muted hover:text-accent-red hover:border-accent-red/30"
                      : "border-[rgba(255,255,255,0.15)] text-white hover:bg-white/[0.04]"
                  }`}
                >
                  {source.status === "Connected" ? "Disconnect" : "Connect"}
                </button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[rgba(255,255,255,0.04)]">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Last Sync</span>
                  <p className="text-[11px] font-mono text-text-muted/60 mt-0.5 tracking-tight">
                    {source.lastSync
                      ? new Date(source.lastSync).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Never"}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Data Points</span>
                  <p className="text-sm font-mono font-bold text-text mt-0.5 tracking-tighter">{count}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
