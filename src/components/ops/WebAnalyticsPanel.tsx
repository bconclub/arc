"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Globe, Loader2, RefreshCw } from "lucide-react";

type ChannelRow = { channel: string; sessions: number; users: number; conversions: number };

type Summary = {
  propertyId: string;
  since: string;
  until: string;
  sessions: number;
  users: number;
  newUsers: number;
  conversions: number;
  channels: ChannelRow[];
};

type Payload = { configured: boolean; error: string | null; detail?: string; data: Summary | null };

const n = (v: number) => v.toLocaleString("en-IN");

/**
 * Website traffic by channel from GA4.
 *
 * Not connected, failing and connected-but-empty are reported separately: the
 * first needs credentials, the second usually needs the service account added to
 * the property, and the third is simply a quiet month.
 */
export function WebAnalyticsPanel() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/ops/web-analytics")
      .then((r) => r.json())
      .catch(() => ({ configured: false, error: "Could not reach the analytics endpoint.", data: null }));
    setPayload(res);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const d = payload?.data;
  const maxSessions = Math.max(...(d?.channels ?? []).map((c) => c.sessions), 1);

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-panel border border-[var(--border)] bg-surface shadow-card">
      <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-2 pt-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[13.5px] font-semibold tracking-tight text-text">
            <Globe size={15} className="text-text-muted" /> Website traffic
          </h2>
          <p className="mt-0.5 truncate text-[11px] text-text-muted">
            {d ? `Last 30 days, by channel` : "Sessions and conversions from GA4"}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          aria-label="Refresh analytics"
          className="shrink-0 rounded-pill p-1.5 text-text-muted transition-colors hover:text-text disabled:opacity-50"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        </button>
      </div>

      {loading ? (
        <p className="px-4 py-8 text-center text-[12px] text-text-muted">Loading.</p>
      ) : payload?.configured === false ? (
        <div className="px-4 py-6 text-center">
          <p className="text-[12px] text-text-muted">{payload.detail ?? "Not connected."}</p>
          <a
            href="https://console.cloud.google.com/iam-admin/serviceaccounts"
            target="_blank" rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-[var(--brand-text)] hover:underline"
          >
            Create a service account <ExternalLink size={11} />
          </a>
          {/* The two steps with no CLI, and the id everyone gets wrong. */}
          <p className="mt-1 text-[10.5px] leading-relaxed text-text-muted">
            Then add it as a Viewer on the GA4 property, and use the numeric property id
            from Admin, Property Settings, not the G-XXXXXXX measurement id.
          </p>
        </div>
      ) : payload?.error ? (
        <p className="mx-4 mb-4 rounded-soft bg-[rgba(255,68,68,0.1)] px-3 py-2 text-[11.5px] text-accent-red">
          {payload.error}
        </p>
      ) : !d || d.channels.length === 0 ? (
        <p className="px-4 py-8 text-center text-[12px] text-text-muted">
          Connected, but no sessions recorded in this window.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 px-4 pb-3">
            {[
              { l: "Sessions", v: n(d.sessions) },
              { l: "Users", v: n(d.users) },
              { l: "New", v: n(d.newUsers) },
              { l: "Conversions", v: n(d.conversions) },
            ].map((s) => (
              <div key={s.l} className="min-w-0">
                <p className="truncate text-[15px] font-bold tabular-nums text-text">{s.v}</p>
                <p className="truncate text-[10px] text-text-muted">{s.l}</p>
              </div>
            ))}
          </div>

          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
            {d.channels.map((c) => (
              <li key={c.channel}>
                <div className="flex items-center gap-2 text-[11.5px]">
                  <span className="min-w-0 flex-1 truncate text-text">{c.channel}</span>
                  <span className="shrink-0 tabular-nums text-text-muted">
                    {n(c.sessions)}
                    {c.conversions > 0 && <span className="text-accent-green"> · {n(c.conversions)} conv</span>}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-pill bg-[var(--surface-hover)]">
                  <div
                    className="h-full rounded-pill"
                    style={{ width: `${(c.sessions / maxSessions) * 100}%`, background: "var(--accent-green)" }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
