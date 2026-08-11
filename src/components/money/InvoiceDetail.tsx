"use client";

import { useRef, useState } from "react";
import { Check, FileUp, Loader2, Pencil, X } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { money } from "@/lib/format";
import { dueLabel } from "@/lib/money";
import type { Payment } from "@/types/ops";

/** Mirrors ParsedInvoice in lib/invoices/parse.ts. */
type Parsed = {
  invoice_no: string | null;
  issued_on: string | null;
  due_on: string | null;
  client: string | null;
  description: string | null;
  currency: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  gstin: string | null;
  confidence: "high" | "medium" | "low";
  notes: string | null;
};

const CONFIDENCE_TONE = { high: "good", medium: "warn", low: "bad" } as const;

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="shrink-0 text-[11.5px] text-text-muted">{label}</span>
      <span className={`min-w-0 truncate text-right text-[12.5px] tabular-nums ${strong ? "font-semibold text-text" : "text-text"}`}>
        {value}
      </span>
    </div>
  );
}

export function InvoiceDetail({
  payment, onChanged, onEdit,
}: {
  payment: Payment | null;
  onChanged: () => void;
  onEdit: (p: Payment) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);

  if (!payment) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-panel border border-dashed border-[var(--border)] p-8">
        <p className="text-center text-[12.5px] text-text-muted">Select an invoice to see its detail.</p>
      </div>
    );
  }

  const d = dueLabel(payment.due);

  async function upload(file: File) {
    setParsing(true); setError(""); setParsed(null); setSourceName(file.name);
    try {
      const body = new FormData();
      body.append("file", file);
      // Parse only — nothing is written until the figures below are confirmed.
      const res = await fetch("/api/ops/invoices/parse", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Could not read that file."); return; }
      setParsed(json.parsed as Parsed);
    } catch {
      setError("Upload failed.");
    } finally {
      setParsing(false);
    }
  }

  /** Writes the parsed figures onto the row via the existing payments endpoint,
   *  rather than re-posting the file with apply=true — that would re-read the
   *  document and bill a second model call for figures already on screen. */
  async function applyParsed() {
    if (!parsed || !payment) return;
    setApplying(true);
    const patch: Record<string, unknown> = {};
    if (parsed.total_amount != null) patch.amount = parsed.total_amount;
    if (parsed.due_on) patch.due = parsed.due_on;
    if (parsed.description && !payment.item) patch.item = parsed.description;
    const res = await fetch(`/api/ops/payments/${payment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setApplying(false);
    if (!res.ok) { setError("Could not save those figures."); return; }
    setParsed(null); setSourceName(""); onChanged();
  }

  async function markPaid() {
    if (!payment) return;
    await fetch(`/api/ops/payments/${payment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    onChanged();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-panel border border-[var(--border)] bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-semibold tracking-tight text-text">{payment.client || "Unnamed"}</h2>
          <p className="mt-0.5 truncate text-[12px] text-text-muted">{payment.item || "No description"}</p>
        </div>
        <StatusPill status={payment.status} />
      </div>

      <div className="rounded-soft bg-[var(--surface-hover)] px-3 py-2">
        <Row label="Amount" strong value={payment.amount == null
          ? <span className="text-accent-orange">Not recorded</span>
          : money(payment.amount)} />
        <Row label="Due" value={<span className={d.tone === "overdue" ? "text-accent-red" : ""}>{payment.due ?? "—"}</span>} />
        <Row label="Status" value={d.text} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={parsing}
          className="flex items-center gap-1.5 rounded-pill bg-[var(--brand)] px-3 py-1.5 text-[12px] font-semibold text-[var(--brand-ink)] disabled:opacity-60"
        >
          {parsing ? <Loader2 size={13} className="animate-spin" /> : <FileUp size={13} />}
          {parsing ? "Reading…" : payment.amount == null ? "Read invoice file" : "Re-read invoice"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
        />
        <button onClick={() => onEdit(payment)} className="flex items-center gap-1.5 rounded-pill border border-[var(--border-strong)] px-3 py-1.5 text-[12px] text-text-muted hover:text-text">
          <Pencil size={12} /> Edit
        </button>
        {payment.status !== "paid" && (
          <button onClick={markPaid} className="flex items-center gap-1.5 rounded-pill border border-[var(--border-strong)] px-3 py-1.5 text-[12px] text-text-muted hover:text-accent-green">
            <Check size={12} /> Mark paid
          </button>
        )}
      </div>

      {parsing && (
        <p className="text-[11.5px] text-text-muted">
          Reading {sourceName} · scanned invoices take about 15 seconds.
        </p>
      )}

      {error && (
        <p className="rounded-soft bg-[rgba(255,68,68,0.1)] px-3 py-2 text-[12px] text-accent-red">{error}</p>
      )}

      {parsed && (
        <section className="rounded-soft border border-[var(--brand-line)] bg-[var(--brand-faint)] p-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-semibold text-text">Read from {sourceName}</h3>
            <StatusPill status={`${parsed.confidence} confidence`} tone={CONFIDENCE_TONE[parsed.confidence]} />
          </div>

          {/* Nothing here has been saved yet — the figures are a proposal until
              confirmed, because a wrong amount written silently into the books
              is worse than a blank one. */}
          <div className="divide-y divide-[var(--border)]">
            <Row label="Invoice no" value={parsed.invoice_no ?? "—"} />
            <Row label="Issued" value={parsed.issued_on ?? "—"} />
            <Row label="Due" value={parsed.due_on ?? "—"} />
            <Row label="Billed to" value={parsed.client ?? "—"} />
            <Row label="Subtotal" value={parsed.subtotal == null ? "—" : money(parsed.subtotal)} />
            <Row label="GST" value={parsed.tax_amount == null ? "—" : money(parsed.tax_amount)} />
            <Row label="Total" strong value={parsed.total_amount == null ? "—" : money(parsed.total_amount)} />
            {parsed.gstin && <Row label="GSTIN" value={parsed.gstin} />}
          </div>

          {parsed.notes && (
            <p className="mt-2 border-t border-[var(--border)] pt-2 text-[11px] leading-relaxed text-text-muted">
              {parsed.notes}
            </p>
          )}

          {parsed.client && payment.client &&
            parsed.client.trim().toLowerCase() !== payment.client.trim().toLowerCase() && (
            <p className="mt-2 rounded bg-[rgba(245,158,11,0.12)] px-2 py-1.5 text-[11px] text-accent-orange">
              This invoice is billed to “{parsed.client}”, but the row says “{payment.client}”. Check you
              have attached the right file before saving.
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={applyParsed}
              disabled={applying || parsed.total_amount == null}
              className="flex items-center gap-1.5 rounded-pill bg-[var(--brand)] px-3 py-1.5 text-[12px] font-semibold text-[var(--brand-ink)] disabled:opacity-50"
            >
              {applying ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {parsed.total_amount == null ? "No total found" : `Save ${money(parsed.total_amount)}`}
            </button>
            <button
              onClick={() => { setParsed(null); setSourceName(""); }}
              className="flex items-center gap-1 rounded-pill px-2 py-1.5 text-[12px] text-text-muted hover:text-text"
            >
              <X size={12} /> Discard
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
