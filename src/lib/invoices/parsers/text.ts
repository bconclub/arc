import { extractText, getDocumentProxy } from "unpdf";

/**
 * Pulls the text layer out of a digital PDF. Free and instant, which is why it
 * is the first rung of the ladder — but BCON's own invoices stopped carrying a
 * text layer after April 2026, so a near-empty result here means "flattened
 * image", not "blank invoice", and the caller moves down a rung.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return typeof text === "string" ? text : String(text ?? "");
}
