"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, Loader2, RotateCcw, X } from "lucide-react";
import { StatusPill, type Tone } from "@/components/ui/StatusPill";
import { timeAgo } from "@/lib/format";
import type { OpsSignal } from "@/types/ops";

const SEV_TONE: Record<OpsSignal["severity"], Tone> = {
  critical: "bad",
  high: "warn",
  warn: "warn",
  info: "neutral",
};

/**
 * A signal opened up: full detail, and a place to say what was done about it.
 *
 * Marking something solved used to flip a boolean and lose the only part worth
 * keeping, which is what was actually done. The note is stored on the signal so
 * a recurring alert can be read against how it was handled last time.
 */
export function SignalDetail({
  signal, onClose, onChanged,
}: {
  signal: OpsSignal & { resolution?: string | null; resolved_at?: string | null };
  onClose: () => void;
  onChanged: () => void;
}) {
  const [note, setNote] = useState(signal.resolution ?? "");
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");

  const resolved = !!signal.resolved_at || signal.seen;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send(body: Record<string, unknown>) {
    setSaving(true); setError(""); setWarning("");
    const res = await fetch(`/api/ops/alerts/${signal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "Could not save."); return; }
    if (json.warning) setWarning(json.warning);
    onChanged();
    if (!json.warning) onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={signal.title}
        className="animate-fade-in relative flex max-h-[85vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-panel border border-[var(--border)] bg-surface p-4 shadow-panel sm:m-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={signal.severity} tone={SEV_TONE[signal.severity]} />
              {resolved && <StatusPill status="solved" tone="good" />}
              {signal.source && <span className="text-[11px] text-text-muted">{signal.source}</span>}
            </div>
            <h2 className="mt-1.5 text-[16px] font-semibold leading-snug tracking-tight text-text">
              {signal.title}
            </h2>
            <p className="mt-0.5 text-[11px] text-text-muted">{timeAgo(signal.ts)}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 rounded-lg p-1 text-text-muted hover:text-text">
            <X size={16} />
          </button>
        </div>

        {signal.detail && (
          <p className="whitespace-pre-wrap rounded-soft bg-[var(--surface-hover)] p-3 text-[12.5px] leading-relaxed text-text">
            {signal.detail}
          </p>
        )}

        {signal.url && (
          <a
            href={signal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[12px] text-[var(--brand-text)] hover:underline"
          >
            Open source <ExternalLink size={12} />
          </a>
        )}

        <label className="block">
          <span className="mb-1 block text-[11px] text-text-muted">
            What was done about it
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Restarted the worker and raised the timeout. Watch for a week."
            className="w-full resize-y rounded-soft border border-[var(--border)] bg-[var(--surface-hover)] p-2.5 text-[12.5px] text-text placeholder:text-text-muted"
          />
        </label>

        {warning && (
          <p className="rounded-soft bg-[rgba(245,158,11,0.12)] px-3 py-2 text-[11.5px] text-accent-orange">{warning}</p>
        )}
        {error && (
          <p className="rounded-soft bg-[rgba(255,68,68,0.1)] px-3 py-2 text-[11.5px] text-accent-red">{error}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!resolved ? (
            <button
              onClick={() => send({ resolved: true, resolution: note.trim() })}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-pill bg-[var(--brand)] px-3 py-1.5 text-[12px] font-semibold text-[var(--brand-ink)] disabled:opacity-60"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Mark solved
            </button>
          ) : (
            <>
              <button
                onClick={() => send({ resolution: note.trim() })}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-pill bg-[var(--brand)] px-3 py-1.5 text-[12px] font-semibold text-[var(--brand-ink)] disabled:opacity-60"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save note
              </button>
              <button
                onClick={() => send({ resolved: false })}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-pill border border-[var(--border-strong)] px-3 py-1.5 text-[12px] text-text-muted hover:text-text"
              >
                <RotateCcw size={12} /> Reopen
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
