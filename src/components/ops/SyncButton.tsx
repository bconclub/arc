"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";

type Result = {
  configured?: boolean;
  detail?: string;
  error?: string;
  scanned?: number;
  queued?: number;
  skipped?: number;
  failed?: number;
};

/**
 * One button: read the mail, parse the invoices, say what is new.
 *
 * There is no mail browser to go with it on purpose. Mail is read in a mail
 * client; what ARC needs from it is the invoices, so this does that job and
 * nothing else. Anything it finds goes to the review queue rather than straight
 * into a payment row, since a wrong amount written silently is worse than a
 * blank one.
 */
export function SyncButton({ onDone }: { onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function sync() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/ops/invoices/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => null)) as Result | null;
      setResult(body ?? { error: `Sync failed (${res.status}).` });
      onDone?.();
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : "Sync failed." });
    } finally {
      setBusy(false);
    }
  }

  const queued = result?.queued ?? 0;
  // Each of these means a different thing and needs a different response, so
  // they are never folded into one "no data" line.
  const message =
    result == null ? null
    : result.error ? result.error
    : result.configured === false ? (result.detail ?? "Gmail is not connected.")
    : queued > 0 ? `${queued} new invoice${queued === 1 ? "" : "s"} found, waiting for review`
    : result.failed ? `Nothing new. ${result.failed} attachment${result.failed === 1 ? "" : "s"} could not be read.`
    : `Nothing new. Read ${result.scanned ?? 0}, all seen before.`;

  const bad = Boolean(result?.error) || result?.configured === false;

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      <button
        onClick={sync}
        disabled={busy}
        className="flex shrink-0 items-center gap-1.5 rounded-pill border border-[var(--border-strong)] px-3 py-1.5 text-[12px] font-medium text-text transition-colors hover:bg-[var(--glow-white)] disabled:opacity-60"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        {busy ? "Reading mail." : "Sync email"}
      </button>

      {message && (
        <span
          className={`text-[11.5px] ${bad ? "text-accent-red" : queued > 0 ? "text-accent-orange" : "text-text-muted"}`}
        >
          {message}
          {queued > 0 && (
            <Link href="/dashboard/ops/money" className="ml-1.5 inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
              Review <ArrowRight size={10} />
            </Link>
          )}
        </span>
      )}
    </div>
  );
}
