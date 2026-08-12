"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Inbox, Loader2, Mail, RefreshCw, X } from "lucide-react";
import { StatusPill, type Tone } from "@/components/ui/StatusPill";
import { money } from "@/lib/format";
import type { Payment } from "@/types/ops";

type Parsed = {
  invoice_no: string | null;
  issued_on: string | null;
  due_on: string | null;
  client: string | null;
  description: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  gstin: string | null;
  confidence: "high" | "medium" | "low";
  notes: string | null;
};

type QueueItem = {
  id: string;
  filename: string | null;
  subject: string | null;
  from_address: string | null;
  sent_at: string | null;
  parsed: Parsed | null;
  status: string;
  error: string | null;
};

const CONFIDENCE_TONE: Record<string, Tone> = { high: "good", medium: "warn", low: "bad" };

/**
 * Invoices read out of email, waiting on a decision.
 *
 * Everything here is a proposal. The scan never writes to a payment row, because
 * these figures go into the books and a wrong amount written silently is worse
 * than a blank one. Rejecting keeps the record so the same attachment is not
 * offered again on the next scan.
 */
export function InvoiceQueue({
  payments, onChanged, brand, title = "From email",
}: {
  payments: Payment[];
  onChanged: () => void;
  /** Scopes the Gmail search to one brand, for use on a brand page. */
  brand?: string;
  title?: string;
}) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [attach, setAttach] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/ops/invoices/queue?status=pending").then((r) => r.json()).catch(() => ({}));
    setItems(Array.isArray(res.items) ? res.items : []);
    setDetail(res.detail ?? "");
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function scan() {
    setScanning(true); setError("");
    // Quoting the brand keeps a multi-word name from matching each word
    // separately, which would pull in half the mailbox.
    const body = brand
      ? JSON.stringify({ query: `has:attachment filename:pdf "${brand.replace(/"/g, "")}"` })
      : "{}";
    const res = await fetch("/api/ops/invoices/scan", { method: "POST", body })
      .then((r) => r.json()).catch(() => ({ error: "Scan failed." }));
    setScanning(false);
    if (res.configured === false) { setDetail(res.detail ?? ""); return; }
    if (res.error) { setError(res.error); return; }
    // Say what happened rather than just refreshing: "nothing new" and "read
    // three, all failed" look identical otherwise.
    setDetail(
      `Scanned ${res.scanned}. ${res.queued} queued` +
      (res.failed ? `, ${res.failed} could not be read` : "") +
      (res.remaining ? `, ${res.remaining} still to do` : "") + ".",
    );
    load();
  }

  async function decide(item: QueueItem, action: "accept" | "reject") {
    setBusyId(item.id); setError("");
    const res = await fetch(`/api/ops/invoices/queue/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, paymentId: attach[item.id] || undefined }),
    });
    const json = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) { setError(json.error ?? "Could not save that decision."); return; }
    load();
    if (action === "accept") onChanged();
  }

  const unpriced = payments.filter((p) => p.amount == null);

  if (!loading && items.length === 0 && !detail && !error) return null;

  return (
    <section className="rounded-panel border border-[var(--border)] bg-surface p-3 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-text">
          <Mail size={15} className="text-text-muted" />
          {title}
          {items.length > 0 && (
            <span className="rounded-pill bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-text)]">
              {items.length}
            </span>
          )}
        </h2>
        <button
          onClick={scan}
          disabled={scanning}
          className="flex items-center gap-1.5 rounded-pill border border-[var(--border-strong)] px-3 py-1.5 text-[12px] text-text-muted transition-colors hover:text-text disabled:opacity-60"
        >
          {scanning ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {scanning ? "Reading mail" : brand ? "Find invoices in email" : "Scan email"}
        </button>
      </div>

      {detail && <p className="mt-2 text-[11.5px] text-text-muted">{detail}</p>}
      {error && (
        <p className="mt-2 rounded-soft bg-[rgba(255,68,68,0.1)] px-3 py-2 text-[11.5px] text-accent-red">{error}</p>
      )}

      {loading ? (
        <p className="py-6 text-center text-[12px] text-text-muted">Loading.</p>
      ) : items.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-6 text-[12px] text-text-muted">
          <Inbox size={14} /> Nothing waiting for review.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((it) => {
            const p = it.parsed;
            return (
              <li key={it.id} className="rounded-soft border border-[var(--border)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium text-text">
                      {p?.client ?? it.subject ?? it.filename ?? "Unknown"}
                    </p>
                    <p className="truncate text-[11px] text-text-muted">
                      {it.filename}
                      {it.sent_at && ` · sent ${it.sent_at.slice(0, 10)}`}
                    </p>
                  </div>
                  {p && <StatusPill status={`${p.confidence} confidence`} tone={CONFIDENCE_TONE[p.confidence] ?? "neutral"} />}
                </div>

                {it.error ? (
                  <p className="mt-2 text-[11.5px] text-accent-red">{it.error}</p>
                ) : p ? (
                  <>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px]">
                      <span className="text-text-muted">Total <span className="font-semibold text-text">{p.total_amount == null ? "not found" : money(p.total_amount)}</span></span>
                      {p.invoice_no && <span className="text-text-muted">No <span className="text-text">{p.invoice_no}</span></span>}
                      {p.issued_on && <span className="text-text-muted">Issued <span className="text-text">{p.issued_on}</span></span>}
                      {p.due_on && <span className="text-text-muted">Due <span className="text-text">{p.due_on}</span></span>}
                    </div>
                    {p.notes && <p className="mt-1.5 text-[10.5px] leading-relaxed text-text-muted">{p.notes}</p>}
                  </>
                ) : null}

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {/* Attaching to an existing blank invoice is the common case:
                      the row already exists, it is the amount that is missing. */}
                  {unpriced.length > 0 && (
                    <select
                      value={attach[it.id] ?? ""}
                      onChange={(e) => setAttach((a) => ({ ...a, [it.id]: e.target.value }))}
                      className="rounded-pill border border-[var(--border)] bg-surface px-2.5 py-1.5 text-[11.5px] text-text"
                    >
                      <option value="">Create a new invoice row</option>
                      {unpriced.map((u) => (
                        <option key={u.id} value={u.id}>
                          Fill in: {u.client ?? "Unnamed"} {u.item ? `(${u.item.slice(0, 32)})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => decide(it, "accept")}
                    disabled={busyId === it.id || !p?.total_amount}
                    title={!p?.total_amount ? "No total was found in this document" : undefined}
                    className="flex items-center gap-1.5 rounded-pill bg-[var(--brand)] px-3 py-1.5 text-[12px] font-semibold text-[var(--brand-ink)] disabled:opacity-50"
                  >
                    {busyId === it.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Accept
                  </button>
                  <button
                    onClick={() => decide(it, "reject")}
                    disabled={busyId === it.id}
                    className="flex items-center gap-1 rounded-pill px-2 py-1.5 text-[12px] text-text-muted hover:text-text"
                  >
                    <X size={12} /> Reject
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
