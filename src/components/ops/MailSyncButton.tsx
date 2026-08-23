"use client";

import { useState } from "react";
import { Loader2, MailSearch } from "lucide-react";

type Result = {
  configured?: boolean;
  detail?: string;
  error?: string | null;
  scanned?: number;
  matched?: number;
  inserted?: number;
  skippedInvoice?: number;
  skippedDup?: number;
};

/**
 * Files this brand's mail as signals on its timeline.
 *
 * Sits beside the invoice scan because it reads the same mailbox, but it is
 * the other half of the job: the scan wants attachments, this wants the
 * conversation. Deliberately one button and one line of result — reading mail
 * happens in Gmail, and the link on each signal goes there.
 */
export function MailSyncButton({ brand, onDone }: { brand?: string; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function sync() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/ops/mail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brand ? { brand } : {}),
      });
      const json = (await res.json().catch(() => null)) as Result | null;
      setResult(json ?? { error: `Sync failed (${res.status}).` });
      onDone?.();
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : "Sync failed." });
    } finally {
      setBusy(false);
    }
  }

  const inserted = result?.inserted ?? 0;
  // Nothing new has three different causes here, and each one means something
  // different to whoever pressed the button.
  const message =
    result == null ? null
    : result.error ? result.error
    : result.configured === false ? (result.detail ?? "Gmail is not connected.")
    : inserted > 0 ? `${inserted} new message${inserted === 1 ? "" : "s"} on the timeline`
    : result.skippedInvoice ? `Nothing new. ${result.skippedInvoice} already read as invoices.`
    : `Nothing new. Read ${result.scanned ?? 0}, all seen before.`;

  const bad = Boolean(result?.error) || result?.configured === false;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        onClick={sync}
        disabled={busy}
        className="flex shrink-0 items-center gap-1.5 rounded-pill border border-[var(--border-strong)] px-3 py-1.5 text-[12px] text-text-muted transition-colors hover:text-text disabled:opacity-60"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <MailSearch size={13} />}
        {busy ? "Reading mail" : "Sync mail"}
      </button>
      {message && (
        <span className={`text-[11.5px] ${bad ? "text-accent-red" : inserted > 0 ? "text-accent-orange" : "text-text-muted"}`}>
          {message}
        </span>
      )}
    </div>
  );
}
