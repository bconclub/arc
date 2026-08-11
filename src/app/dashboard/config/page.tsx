"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Trash2, Zap, Database, Bot } from "lucide-react";
import { LocalBackup } from "@/components/settings/LocalBackup";

interface ModelUse { input: number; output: number; calls: number; cost_usd: number }
interface ActionUse { input: number; output: number; calls: number }
interface Usage {
  total_input: number; total_output: number; total_cost_usd: number; calls: number;
  by_model: Record<string, ModelUse>; by_action: Record<string, ActionUse>; updated_at: string;
}
interface Status {
  sources: number; active_sources: number; signals: number; last_signal_at: string | null;
  write_model: string; idea_model: string; approval_gate: string;
}

const fmt = (n: number) => n.toLocaleString();
const fmtCost = (n: number) => "$" + n.toFixed(n < 1 ? 4 : 2);

export default function ConfigPage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/arc/usage");
      const data = await res.json();
      setUsage(data.usage);
      setStatus(data.status);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const reset = async () => {
    if (!confirm("Reset token usage counters to zero?")) return;
    await fetch("/api/arc/usage", { method: "DELETE" });
    load();
  };

  return (
    <div className="page space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Config</h1>
          <p className="text-[13px] text-text-muted mt-0.5">Token usage, cost, and system status</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-text-muted hover:text-text bg-surface hover:bg-surface-hover rounded-full transition-all"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Token usage */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] uppercase tracking-wider text-text-muted flex items-center gap-2">
            <Zap size={12} /> Token Usage
          </h2>
          <button onClick={reset} className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-accent-red transition-colors">
            <Trash2 size={12} /> Reset
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Estimated cost" value={usage ? fmtCost(usage.total_cost_usd) : "-"} accent />
          <Stat label="API calls" value={usage ? fmt(usage.calls) : "-"} />
          <Stat label="Input tokens" value={usage ? fmt(usage.total_input) : "-"} />
          <Stat label="Output tokens" value={usage ? fmt(usage.total_output) : "-"} />
        </div>
        <p className="text-[10px] text-text-muted mt-2">
          Cost is an estimate (Sonnet ~$3/$15, Haiku ~$1/$5 per 1M in/out). {usage?.updated_at ? `Updated ${new Date(usage.updated_at).toLocaleString()}` : "No usage recorded yet."}
        </p>

        {/* By model */}
        {usage && Object.keys(usage.by_model).length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-[10px] uppercase tracking-wider text-text-muted">By model</h3>
            {Object.entries(usage.by_model).map(([model, m]) => (
              <div key={model} className="card p-3 flex items-center justify-between text-[12px]">
                <span className="text-text font-medium truncate">{model}</span>
                <span className="text-text-muted shrink-0 tabular-nums">
                  {m.calls} calls · {fmt(m.input)} in / {fmt(m.output)} out · {fmtCost(m.cost_usd)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* By action */}
        {usage && Object.keys(usage.by_action).length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-[10px] uppercase tracking-wider text-text-muted">By action</h3>
            {Object.entries(usage.by_action).sort((a, b) => b[1].output - a[1].output).map(([action, a]) => (
              <div key={action} className="card p-3 flex items-center justify-between text-[12px]">
                <span className="text-text font-medium">{action}</span>
                <span className="text-text-muted shrink-0 tabular-nums">
                  {a.calls} calls · {fmt(a.input + a.output)} tokens
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* System status */}
      <section>
        <h2 className="text-[11px] uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
          <Database size={12} /> System
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Active sources" value={status ? `${status.active_sources}/${status.sources}` : "-"} />
          <Stat label="Cached signals" value={status ? fmt(status.signals) : "-"} />
          <Stat label="Approval gate" value={status?.approval_gate || "-"} />
          <Stat label="Last signal" value={status?.last_signal_at ? new Date(status.last_signal_at).toLocaleDateString() : "-"} />
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="card p-3 flex items-center gap-3 text-[12px]">
            <Bot size={14} className="text-text-muted shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Writing model</div>
              <div className="text-text truncate">{status?.write_model || "-"}</div>
            </div>
          </div>
          <div className="card p-3 flex items-center gap-3 text-[12px]">
            <Zap size={14} className="text-text-muted shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Idea model (cheap)</div>
              <div className="text-text truncate">{status?.idea_model || "-"}</div>
            </div>
          </div>
        </div>
      </section>

      <LocalBackup />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className={`text-[22px] font-bold tabular-nums mt-1 ${accent ? "text-accent-green" : "text-text"}`}>{value}</div>
    </div>
  );
}
