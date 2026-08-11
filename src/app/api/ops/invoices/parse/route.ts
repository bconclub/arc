import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { parseInvoice, SUPPORTED_MIME, type ParsedInvoice } from "@/lib/invoices/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
// Reading a multi-page scan is slower than a normal request.
export const maxDuration = 120;

/** The Messages API caps a request at 32MB, and base64 inflates by ~4/3. */
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * POST multipart/form-data
 *   file       — the invoice (PDF, PNG, JPEG, WebP, GIF)
 *   paymentId  — optional; write the parsed figures onto this payment row
 *   apply      — optional "true"; without it nothing is written
 *
 * Parsing and writing are deliberately separate. Several payment rows carry a
 * null amount, and a wrong figure written silently into the books is worse than
 * no figure at all — so the default is to return what was read and let the
 * caller confirm it before it lands.
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data with a `file` field." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 20MB.` },
      { status: 413 },
    );
  }

  // Browsers sometimes send an empty or generic type, so fall back to the
  // extension rather than rejecting a perfectly readable PDF.
  const mime = file.type && file.type !== "application/octet-stream"
    ? file.type
    : /\.pdf$/i.test(file.name)
      ? "application/pdf"
      : /\.png$/i.test(file.name)
        ? "image/png"
        : /\.jpe?g$/i.test(file.name)
          ? "image/jpeg"
          : /\.webp$/i.test(file.name)
            ? "image/webp"
            : "";

  if (!SUPPORTED_MIME.includes(mime as (typeof SUPPORTED_MIME)[number])) {
    return NextResponse.json(
      { error: `Can't read ${file.name}. Supported: PDF, PNG, JPEG, WebP.` },
      { status: 415 },
    );
  }

  let parsed: ParsedInvoice;
  try {
    parsed = await parseInvoice(new Uint8Array(await file.arrayBuffer()), mime, file.name);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read that invoice.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const paymentId = form.get("paymentId");
  const apply = form.get("apply") === "true";

  if (!apply || typeof paymentId !== "string" || !paymentId) {
    return NextResponse.json({ parsed, applied: null, file: file.name });
  }

  if (parsed.total_amount == null) {
    return NextResponse.json({
      parsed,
      applied: null,
      file: file.name,
      error: "No total found on that document, so nothing was written.",
    });
  }

  // Only fill what the document actually establishes — a null due date on the
  // invoice must not wipe a due date already recorded in ARC.
  const patch: Record<string, unknown> = { amount: parsed.total_amount };
  if (parsed.due_on) patch.due = parsed.due_on;
  if (parsed.description) patch.item = parsed.description;

  const { data, error } = await supabaseAdmin
    .from("payments")
    .update(patch)
    .eq("id", paymentId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ parsed, applied: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ parsed, applied: data, file: file.name });
}
