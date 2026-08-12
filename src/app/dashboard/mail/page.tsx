"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText, Inbox, Loader2, Mail, Paperclip, Search, Sparkles,
} from "lucide-react";
import { MasterDetail } from "@/components/ui/MasterDetail";
import { InvoiceQueue } from "@/components/money/InvoiceQueue";
import { shortAgo } from "@/lib/format";
import type { Payment } from "@/types/ops";

type Attachment = { attachmentId: string; filename: string; mimeType: string; sizeBytes: number };

type MailSummary = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string | null;
  snippet: string;
  attachments: Attachment[];
};

type MailDetail = MailSummary & { body: string };

/** Types the browser renders in place. Anything else is offered as a download. */
const VIEWABLE = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"]);

const PRESETS = [
  { label: "With attachments", q: "has:attachment" },
  { label: "Invoices sent", q: 'in:sent has:attachment filename:pdf (invoice OR "tax invoice")' },
  { label: "PDFs received", q: "has:attachment filename:pdf -in:sent" },
  { label: "Last 30 days", q: "has:attachment newer_than:30d" },
];

/** "Name <a@b.com>" is mostly noise in a list; the name alone is the useful part. */
function displayName(addr: string): string {
  const m = addr.match(/^\s*"?([^"<]+?)"?\s*</);
  return (m ? m[1] : addr).trim() || addr;
}

function kb(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function MailPage() {
  const [q, setQ] = useState(PRESETS[0].q);
  const [draftQ, setDraftQ] = useState(PRESETS[0].q);
  const [messages, setMessages] = useState<MailSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MailDetail | null>(null);
  const [openAttachment, setOpenAttachment] = useState<Attachment | null>(null);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState("");
  const [notConnected, setNotConnected] = useState("");
  const [error, setError] = useState("");
  const [queueKey, setQueueKey] = useState(0);

  const load = useCallback(async (query: string) => {
    setLoading(true); setError(""); setNotConnected("");
    const res = await fetch(`/api/ops/mail?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .catch(() => ({ configured: false, detail: "Could not reach the mail endpoint." }));
    if (res.configured === false) setNotConnected(res.detail ?? "Gmail is not connected.");
    else if (res.error) setError(res.error);
    setMessages(Array.isArray(res.messages) ? res.messages : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(q); }, [load, q]);

  useEffect(() => {
    fetch("/api/ops/payments").then((r) => r.json())
      .then((d) => setPayments(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Opening a message fetches its body; the list deliberately does not carry it.
  useEffect(() => {
    if (!selectedId) { setDetail(null); setOpenAttachment(null); return; }
    setDetail(null); setOpenAttachment(null);
    fetch(`/api/ops/mail/${selectedId}`)
      .then((r) => r.json())
      .then((d) => setDetail(d.message ?? null))
      .catch(() => setDetail(null));
  }, [selectedId]);

  /** The one button: read the mail, parse anything new, say what turned up. */
  async function sync() {
    setSyncing(true); setSyncNote(""); setError("");
    const res = await fetch("/api/ops/invoices/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Parse against the query on screen, so what you are looking at is what
      // gets read. A hidden second query would be a different mailbox.
      body: JSON.stringify({ query: q }),
    }).then((r) => r.json()).catch(() => ({ error: "Sync failed." }));
    setSyncing(false);

    if (res.configured === false) { setNotConnected(res.detail ?? ""); return; }
    if (res.error) { setError(res.error); return; }

    setSyncNote(
      res.queued > 0
        ? `${res.queued} new invoice${res.queued === 1 ? "" : "s"} read and waiting below.`
        : `Nothing new. ${res.scanned} message${res.scanned === 1 ? "" : "s"} checked, all seen before.`
      + (res.failed ? ` ${res.failed} could not be read.` : "")
      + (res.remaining ? ` ${res.remaining} still to do, run it again.` : ""),
    );
    setQueueKey((k) => k + 1);
    load(q);
  }

  const selected = useMemo(() => messages.find((m) => m.id === selectedId) ?? null, [messages, selectedId]);

  const listPane = (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-panel border border-[var(--border)] bg-surface shadow-card">
      <div className="shrink-0 border-b border-[var(--border)] p-2">
        <form
          onSubmit={(e) => { e.preventDefault(); setQ(draftQ); }}
          className="relative flex items-center"
        >
          <Search size={13} className="pointer-events-none absolute left-3 text-text-muted" />
          <input
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            placeholder="Gmail search, e.g. from:client has:attachment"
            className="w-full rounded-pill border border-[var(--border)] bg-[var(--surface-hover)] py-1.5 pl-8 pr-3 text-[12px] text-text placeholder:text-text-muted"
          />
        </form>
        <div className="scrollbar-hide mt-2 flex gap-1 overflow-x-auto">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => { setDraftQ(p.q); setQ(p.q); }}
              className={`shrink-0 rounded-pill px-2.5 py-1 text-[11px] transition-colors ${
                q === p.q ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "text-text-muted hover:text-text"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-4 py-10 text-center text-[12px] text-text-muted">Reading mail.</p>
        ) : messages.length === 0 ? (
          <p className="px-4 py-10 text-center text-[12px] text-text-muted">No messages match that search.</p>
        ) : (
          messages.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`flex w-full flex-col gap-0.5 border-b border-[var(--border)] px-3 py-2.5 text-left transition-colors last:border-b-0 ${
                m.id === selectedId ? "bg-[var(--brand-faint)]" : "hover:bg-[var(--surface-hover)]"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-text">
                  {m.subject || "(no subject)"}
                </span>
                <span className="shrink-0 text-[10.5px] text-text-muted">{m.date ? shortAgo(m.date) : ""}</span>
              </span>
              <span className="truncate text-[11px] text-text-muted">{displayName(m.from)}</span>
              {m.attachments.length > 0 && (
                <span className="mt-0.5 flex flex-wrap items-center gap-1">
                  {m.attachments.slice(0, 3).map((a) => (
                    <span
                      key={a.attachmentId}
                      className="flex items-center gap-1 rounded-pill bg-[var(--surface-hover)] px-1.5 py-0.5 text-[10px] text-text-muted"
                    >
                      <Paperclip size={9} /> {a.filename.length > 22 ? a.filename.slice(0, 20) + "…" : a.filename}
                    </span>
                  ))}
                  {m.attachments.length > 3 && (
                    <span className="text-[10px] text-text-muted">+{m.attachments.length - 3}</span>
                  )}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );

  const detailPane = !selected ? (
    <div className="flex min-h-0 flex-1 items-center justify-center rounded-panel border border-dashed border-[var(--border)] p-8">
      <p className="text-center text-[12.5px] text-text-muted">Pick a message to read it and open its attachments.</p>
    </div>
  ) : (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-panel border border-[var(--border)] bg-surface p-4 shadow-card">
      <div>
        <h2 className="text-[16px] font-semibold leading-snug tracking-tight text-text">
          {selected.subject || "(no subject)"}
        </h2>
        <p className="mt-1 text-[11.5px] text-text-muted">
          {selected.from} {selected.to && <>to {selected.to}</>}
          {selected.date && ` · ${new Date(selected.date).toLocaleString("en-GB")}`}
        </p>
      </div>

      {selected.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.attachments.map((a) => (
            <button
              key={a.attachmentId}
              onClick={() => setOpenAttachment(openAttachment?.attachmentId === a.attachmentId ? null : a)}
              className={`flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[11.5px] transition-colors ${
                openAttachment?.attachmentId === a.attachmentId
                  ? "border-[var(--brand-line)] bg-[var(--brand-faint)] text-[var(--brand-text)]"
                  : "border-[var(--border-strong)] text-text-muted hover:text-text"
              }`}
            >
              <FileText size={12} /> {a.filename}
              <span className="opacity-70">{kb(a.sizeBytes)}</span>
            </button>
          ))}
        </div>
      )}

      {openAttachment && (
        VIEWABLE.has(openAttachment.mimeType) ? (
          // An iframe rather than a PDF library: the browser's own viewer already
          // handles paging, zoom and search, and adding a renderer would ship a
          // large dependency to duplicate it.
          <iframe
            key={openAttachment.attachmentId}
            title={openAttachment.filename}
            src={`/api/ops/mail/${selected.id}/attachment/${openAttachment.attachmentId}?type=${encodeURIComponent(openAttachment.mimeType)}&name=${encodeURIComponent(openAttachment.filename)}`}
            className="h-[60vh] w-full rounded-soft border border-[var(--border)] bg-white"
          />
        ) : (
          <a
            href={`/api/ops/mail/${selected.id}/attachment/${openAttachment.attachmentId}?type=${encodeURIComponent(openAttachment.mimeType)}&name=${encodeURIComponent(openAttachment.filename)}`}
            className="rounded-soft bg-[var(--surface-hover)] px-3 py-2 text-[12px] text-[var(--brand-text)] hover:underline"
          >
            {openAttachment.filename} cannot be shown in the browser. Download it instead.
          </a>
        )
      )}

      {detail ? (
        detail.body ? (
          <pre className="whitespace-pre-wrap rounded-soft bg-[var(--surface-hover)] p-3 font-sans text-[12.5px] leading-relaxed text-text">
            {detail.body}
          </pre>
        ) : (
          <p className="text-[12px] text-text-muted">This message has no readable text body.</p>
        )
      ) : (
        <p className="flex items-center gap-2 text-[12px] text-text-muted">
          <Loader2 size={13} className="animate-spin" /> Loading the message.
        </p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-3 px-4 pb-4 pt-4 sm:px-5 lg:h-[100dvh] lg:px-6">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Mail size={19} className="text-text-muted" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text">Mail</h1>
            <p className="mt-0.5 text-[12.5px] text-text-muted">
              Read the mail, open the PDF, pull out what is new
            </p>
          </div>
        </div>
        <button
          onClick={sync}
          disabled={syncing || !!notConnected}
          className="flex items-center gap-2 rounded-pill bg-[var(--brand)] px-4 py-2 text-[13px] font-semibold text-[var(--brand-ink)] disabled:opacity-50"
        >
          {syncing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {syncing ? "Reading and parsing" : "Sync and read new"}
        </button>
      </header>

      {notConnected && (
        <div className="shrink-0 rounded-panel border border-[var(--border)] bg-surface p-4 text-center shadow-card">
          <Inbox size={18} className="mx-auto mb-2 text-text-muted" />
          <p className="text-[12.5px] text-text-muted">{notConnected}</p>
          <p className="mt-1 text-[11px] text-text-muted">
            Everything else is ready: reading, parsing and the review queue. Only the credentials are missing.
          </p>
        </div>
      )}
      {syncNote && (
        <p className="shrink-0 rounded-soft bg-[var(--brand-faint)] px-3 py-2 text-[12px] text-[var(--brand-text)]">
          {syncNote}
        </p>
      )}
      {error && (
        <p className="shrink-0 rounded-soft bg-[rgba(255,68,68,0.1)] px-3 py-2 text-[12px] text-accent-red">{error}</p>
      )}

      {/* What the sync turned up. Renders nothing when there is nothing new. */}
      <div className="shrink-0">
        <InvoiceQueue key={queueKey} payments={payments} onChanged={() => setQueueKey((k) => k + 1)} title="New from this sync" />
      </div>

      {!notConnected && (
        <MasterDetail
          hasSelection={!!selected}
          onBack={() => setSelectedId(null)}
          backLabel="All mail"
          listWidth="380px"
          list={listPane}
          detail={detailPane}
        />
      )}
    </div>
  );
}
