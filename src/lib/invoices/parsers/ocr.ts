/**
 * Tesseract OCR for image invoices (photos, PNG/JPEG exports).
 *
 * WASM build, so it runs on the Vercel Node runtime with no native deps. The
 * language data downloads on first use and caches in /tmp — the only writable
 * path in a lambda — so a warm function pays the cost once.
 *
 * Gated behind OCR_ENABLED because the cold start is seconds, not
 * milliseconds. Scanned PDFs are out of scope for this rung: rasterizing a
 * PDF page needs a canvas implementation this runtime does not carry, so
 * image-only, and flattened PDFs fall through to the model rung.
 */
export function ocrEnabled(): boolean {
  const v = process.env.OCR_ENABLED;
  return v === "1" || v === "true";
}

export async function ocrImage(bytes: Uint8Array): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, { cachePath: "/tmp" });
  try {
    const { data } = await worker.recognize(Buffer.from(bytes));
    return data.text ?? "";
  } finally {
    await worker.terminate();
  }
}
