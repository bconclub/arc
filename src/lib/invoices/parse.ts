import Anthropic from "@anthropic-ai/sdk";

/**
 * Reads an invoice document and returns its fields.
 *
 * Why a model and not a PDF text library: BCON's invoices stopped carrying a
 * text layer somewhere after April 2026. `Invoice_BCON - Windchasers APR25.pdf`
 * still extracts cleanly, but `BCON - YV Homes Invoice.pdf` and
 * `Exam Windchasers Invoice.pdf` are flattened images — pdftotext-style
 * extraction returns "Invoice template design" and nothing else. Claude reads
 * the pages visually, so scanned and image-only invoices work the same as
 * digital ones, and a photographed invoice works too.
 */

// The SDK reads ANTHROPIC_BASE_URL / AUTH_TOKEN from the environment and some
// runtimes inject them; the existing llm.ts clears them for the same reason.
delete process.env.ANTHROPIC_AUTH_TOKEN;
delete process.env.ANTHROPIC_BASE_URL;
delete process.env.ANTHROPIC_CUSTOM_HEADERS;

const MODEL = "claude-opus-5";

/** Anything Claude can read as a page. Photos of invoices are common enough to allow. */
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
};

const nullableString = { type: ["string", "null"] };
const nullableNumber = { type: ["number", "null"] };

const SCHEMA = {
  type: "object",
  properties: {
    invoice_no: nullableString,
    issued_on: nullableString,
    due_on: nullableString,
    client: nullableString,
    description: nullableString,
    currency: nullableString,
    subtotal: nullableNumber,
    tax_amount: nullableNumber,
    total_amount: nullableNumber,
    gstin: nullableString,
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    notes: nullableString,
  },
  required: [
    "invoice_no", "issued_on", "due_on", "client", "description", "currency",
    "subtotal", "tax_amount", "total_amount", "gstin", "confidence", "notes",
  ],
  additionalProperties: false,
} as const;

const SYSTEM = `You read invoices issued by BCON, a design and marketing studio in Bangalore, India.

Return the fields exactly as printed on the document.

- BCON is the SELLER. The client is whoever is billed — the "Bill To" / "Billed To" /
  "Customer" party. Never return BCON, BCON Club, or their GSTIN as the client.
- Amounts are numbers only: no currency symbol, no thousands separators. "₹1,23,456.00"
  is 123456. Indian digit grouping is 2-2-3, so 1,23,456 is one hundred twenty-three
  thousand — not 123.456 and not 12,3456.
- total_amount is the amount actually payable, after GST and after any discount or
  advance already deducted. If the invoice shows a "Balance Due" or "Amount Payable"
  that differs from the gross total, that balance is total_amount.
- Where GST is charged, subtotal + tax_amount must equal total_amount. If they do not
  reconcile, return what is printed and say so in notes rather than adjusting a figure.
- Dates as YYYY-MM-DD. Indian invoices are day-first: 06-07-2026 is 6 July 2026. If a
  date is genuinely ambiguous, say so in notes.
- gstin is the CLIENT's GST number (15 characters) when one is shown; otherwise null.
- Any field not present on the document is null. Never guess a value to fill a field.

Set confidence to "low" if the scan is unclear, figures are cut off, or you had to
choose between readings — and put the specific doubt in notes. An honest "low" is more
useful than a confident wrong number, because these figures go straight into the books.`;

/** Base64 of the raw bytes, with no line breaks (the API rejects wrapped base64). */
function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export async function parseInvoice(
  bytes: Uint8Array,
  mime: string,
  filename?: string,
): Promise<ParsedInvoice> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set on the server.");

  if (!SUPPORTED_MIME.includes(mime as (typeof SUPPORTED_MIME)[number])) {
    throw new Error(`Unsupported file type: ${mime || "unknown"}`);
  }

  const client = new Anthropic({ apiKey });
  const data = toBase64(bytes);

  // A PDF is a `document` block; an image is an `image` block. Sending a PDF as
  // an image (or vice versa) is a 400, so the block type follows the MIME type.
  const source =
    mime === "application/pdf"
      ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data } } as const)
      : ({
          type: "image",
          source: { type: "base64", media_type: mime as "image/png", data },
        } as const);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
    messages: [
      {
        role: "user",
        content: [
          source,
          {
            type: "text",
            text: filename
              ? `Read this invoice (file: ${filename}) and return its fields.`
              : "Read this invoice and return its fields.",
          },
        ],
      },
    ],
  });

  // Safety classifiers can decline with HTTP 200 and an empty content array, so
  // check the stop reason before indexing into content.
  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to read this document.");
  }

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("No readable response from the model.");
  }

  return JSON.parse(text.text) as ParsedInvoice;
}
