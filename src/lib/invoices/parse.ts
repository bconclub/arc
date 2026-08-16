/**
 * Reads an invoice document and returns its fields.
 *
 * A ladder, cheapest rung first:
 *
 *   1. text  — the PDF's own text layer (unpdf). Free, instant. Covers the
 *              pre-April-2026 invoices, which still carry one.
 *   2. rules — deterministic template extraction over that text. BCON's own
 *              invoices come from a closed set of layouts, so rules beat a
 *              model on them and cannot hallucinate a figure.
 *   3. ocr   — tesseract for image files (photographed invoices), feeding the
 *              same rules. Env-gated: OCR_ENABLED=1.
 *   4. haiku — Claude reads the page visually. Only rung that costs money,
 *              only used when the free rungs come up empty or unsure, and
 *              skipped entirely when no key is configured — the caller's
 *              review queue holds the item for a human instead.
 *
 * `parser` on the result records which rung produced the reading, so the
 * review queue can say where a figure came from.
 */
import { extractPdfText } from "./parsers/text";
import { extractFromText } from "./parsers/template";
import { ocrEnabled, ocrImage } from "./parsers/ocr";
import { claudeConfigured, claudeParse } from "./parsers/claude";

/** Anything a rung can read as a page. Photos of invoices are common enough to allow. */
export const SUPPORTED_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type ParsedInvoice = {
  invoice_no: string | null;
  issued_on: string | null;       // YYYY-MM-DD
  due_on: string | null;          // YYYY-MM-DD
  client: string | null;          // who was billed, not BCON
  description: string | null;
  currency: string | null;        // ISO code, e.g. INR
  subtotal: number | null;        // before tax
  tax_amount: number | null;      // GST
  total_amount: number | null;    // what is actually owed
  gstin: string | null;           // the client's GSTIN
  confidence: "high" | "medium" | "low";
  notes: string | null;
  /** which rung produced this reading: template | template+ocr | haiku */
  parser?: string;
};

export async function parseInvoice(
  bytes: Uint8Array,
  mime: string,
  filename?: string,
): Promise<ParsedInvoice> {
  if (!SUPPORTED_MIME.includes(mime as (typeof SUPPORTED_MIME)[number])) {
    throw new Error(`Unsupported file type: ${mime || "unknown"}`);
  }

  // A rules reading that is unsure but non-empty. Kept so that when the model
  // rung is unavailable the queue still gets something a human can correct.
  let fallback: ParsedInvoice | null = null;

  if (mime === "application/pdf") {
    let text = "";
    try {
      text = await extractPdfText(bytes);
    } catch {
      // A malformed or encrypted PDF is not a reason to give up — the model
      // rung reads pages visually.
    }
    // A flattened PDF extracts to nearly nothing; treat that as no text layer.
    if (text.trim().length > 40) {
      const read = extractFromText(text);
      if (read) {
        if (read.confidence !== "low") return { ...read, parser: "template" };
        fallback = { ...read, parser: "template" };
      }
    }
  } else if (ocrEnabled()) {
    let text = "";
    try {
      text = await ocrImage(bytes);
    } catch {
      // OCR failure falls through to the model rung.
    }
    if (text.trim().length > 40) {
      const read = extractFromText(text);
      if (read) {
        if (read.confidence === "high") return { ...read, parser: "template+ocr" };
        // OCR output is noisy enough that medium stays a fallback, not an answer.
        fallback = { ...read, confidence: "low", parser: "template+ocr" };
      }
    }
  }

  if (claudeConfigured()) {
    const read = await claudeParse(bytes, mime, filename);
    return { ...read, parser: "haiku" };
  }

  if (fallback) return fallback;

  throw new Error(
    "No parser could read this document: no text layer or template match, and ANTHROPIC_API_KEY is not configured for the model fallback.",
  );
}
