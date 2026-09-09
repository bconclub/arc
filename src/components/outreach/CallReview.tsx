"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { btnCls } from "@/components/ops/Modal";
import { OutreachDialog } from "./OutreachDialog";
export type BdrCall = {
  id: string;
  agent: string;
  started_at: string;
  duration: number;
  status: string;
  turns: number;
  phone: string | null;
  is_test: boolean | null;
  has_audio: boolean | null;
  summary: string | null;
  outcome?: string | null;
  callback_request?: string | null;
};
type Detail = BdrCall & {
  failure: string | null;
  transcript: { role: string; message: string; seconds: number }[];
};
export function CallReview({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState("");
  const [retry, setRetry] = useState(0),
    [audioError, setAudioError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setDetail(null);
    setError("");
    setAudioError(false);
    fetch("/api/outreach/calls/" + id, { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setDetail(d);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [id, retry]);
  return (
    <OutreachDialog title={detail?.agent || "Call review"} onClose={onClose}>
      <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] p-5">
        <h2 className="text-lg font-semibold">
          {detail?.agent || "Call review"}
        </h2>
        <button aria-label="Close call" className={btnCls} onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="space-y-5 overflow-y-auto p-5">
        {error ? (
          <p role="alert">
            {error}{" "}
            <button className={btnCls} onClick={() => setRetry((v) => v + 1)}>
              Retry
            </button>
          </p>
        ) : !detail ? (
          <p role="status">Loading recording and transcript…</p>
        ) : (
          <>
            <p className="text-sm text-text-muted">
              {detail.phone || "Recipient not recorded"} ·{" "}
              {detail.is_test === true
                ? "Test number"
                : detail.is_test === false
                  ? "Other number"
                  : "Type unknown"}
              <br />
              {new Date(detail.started_at).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}{" "}
              IST · {detail.duration}s ·{" "}
              {detail.status === "done" ? "Call ended" : detail.status}
            </p>
            {detail.outcome && <p>Outcome: {detail.outcome.replace(/_/g, " ")}. Qualification requires review.</p>}
            {detail.callback_request && <p>Callback request: {detail.callback_request}</p>}
            <section aria-label="Recording">
              <h3 className="mb-2 font-medium">Recording</h3>
              {detail.has_audio ? (
                <>
                  <audio
                    key={retry}
                    controls
                    preload="metadata"
                    className="w-full"
                    src={"/api/outreach/calls/" + id + "/audio"}
                    onError={() => setAudioError(true)}
                  />
                  {audioError && (
                    <p role="alert" className="mt-2 text-sm">
                      Recording could not play.{" "}
                      <button
                        className={btnCls}
                        onClick={() => setRetry((v) => v + 1)}
                      >
                        Retry recording
                      </button>
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-text-muted">
                  No recording available for this attempt.
                </p>
              )}
            </section>
            <p className="text-sm leading-relaxed">
              {detail.summary ||
                detail.failure ||
                "No conversation summary available."}
            </p>
            <section aria-label="Transcript">
              <h3 className="mb-3 font-medium">Transcript</h3>
              {detail.transcript.length ? (
                <ol className="space-y-4">
                  {detail.transcript.map((t, i) => (
                    <li key={i}>
                      <p className="text-xs text-text-muted">
                        {t.role === "agent" ? "Agent" : "Recipient"} ·{" "}
                        {Math.floor(t.seconds)}s
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                        {t.message || "[No speech]"}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-text-muted">
                  No transcript available for this attempt.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </OutreachDialog>
  );
}
