import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { findInvoiceAttachments, downloadAttachment, gmailConfigured } from "@/lib/gmail";
import { parseInvoice } from "@/lib/invoices/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
// Each attachment is a model call of roughly 15 seconds.
export const maxDuration = 300;

/**
 * Reads invoice attachments out of Gmail and queues what it finds for review.
 *
 * Nothing is written to a payment row here. The scan produces proposals; a human
 * accepts them one at a time. These figures go into the books, and a wrong
 * amount written silently is worse than a blank one, which is the same rule the
 * manual upload flow already follows.
 *
 * Attachments already seen are skipped on their Gmail ids, so re-running is
 * cheap. Without that guard a nightly cron would pay to re-read every invoice
 * it has ever seen, every night.
 */

/** Bounded per run so one invocation cannot spend an unbounded amount. */
const MAX_PER_RUN = 10;

export async function POST(req: NextRequest) {
  if (!gmailConfigured()) {
    return NextResponse.json({
      configured: false,
      detail: "Not connected. Missing GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET or GMAIL_REFRESH_TOKEN.",
      scanned: 0, queued: 0, skipped: 0, failed: 0, items: [],
    });
  }

  const body = await req.json().catch(() => ({}));
  const query: string | undefined = body.query;
  const limit = Math.min(MAX_PER_RUN, Math.max(1, Number(body.limit) || MAX_PER_RUN));

  let candidates;
  try {
    candidates = await findInvoiceAttachments(query, 25);
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: e instanceof Error ? e.message : "Gmail search failed." },
      { status: 502 },
    );
  }

  // Everything already recorded, whatever its outcome. A rejected proposal must
  // not come back on the next run.
  const { data: seenRows } = await supabaseAdmin
    .from("email_ingest")
    .select("message_id,attachment_id");
  const seen = new Set((seenRows ?? []).map((r) => `${r.message_id}:${r.attachment_id}`));

  const fresh = candidates.filter((c) => !seen.has(`${c.messageId}:${c.attachmentId}`));
  const batch = fresh.slice(0, limit);

  const items: Record<string, unknown>[] = [];
  let queued = 0;
  let failed = 0;

  for (const c of batch) {
    const row: Record<string, unknown> = {
      message_id: c.messageId,
      attachment_id: c.attachmentId,
      filename: c.filename,
      subject: c.subject,
      from_address: c.from,
      sent_at: c.sentAt,
    };

    try {
      const bytes = await downloadAttachment(c.messageId, c.attachmentId);
      const parsed = await parseInvoice(bytes, c.mimeType, c.filename);
      row.parsed = parsed;
      row.confidence = parsed.confidence;
      row.status = "pending";
      queued += 1;
      items.push({ ...c, parsed });
    } catch (e) {
      // A document that cannot be read is recorded as failed rather than left
      // out. Otherwise the next run tries it again, fails again, and pays again.
      row.status = "failed";
      row.error = e instanceof Error ? e.message : "Could not read the attachment.";
      failed += 1;
      items.push({ ...c, error: row.error });
    }

    await supabaseAdmin.from("email_ingest").upsert(row, { onConflict: "message_id,attachment_id" });
  }

  return NextResponse.json({
    configured: true,
    error: null,
    scanned: candidates.length,
    queued,
    failed,
    skipped: candidates.length - batch.length,
    // Says plainly that more remain, rather than leaving the caller to assume
    // the mailbox is now fully processed.
    remaining: Math.max(0, fresh.length - batch.length),
    items,
  });
}
