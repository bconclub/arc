import { NextRequest } from "next/server";
import { downloadAttachment, gmailConfigured } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

type Ctx = { params: { id: string; attachmentId: string } };

/** Only types a browser will render inline. Anything else downloads instead. */
const INLINE = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"]);

/**
 * GET /api/ops/mail/{id}/attachment/{attachmentId}?type=application/pdf&name=file.pdf
 *
 * Streams the attachment bytes so a PDF can be opened in place rather than
 * downloaded, read, and thrown away. Gmail will not serve these to a browser
 * directly, since every request needs the OAuth token, which is why this proxy
 * exists.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  if (!gmailConfigured()) {
    return new Response("Gmail is not connected.", { status: 503 });
  }

  const type = req.nextUrl.searchParams.get("type") || "application/octet-stream";
  const name = req.nextUrl.searchParams.get("name") || "attachment";

  try {
    const bytes = await downloadAttachment(ctx.params.id, ctx.params.attachmentId);

    // Content-Disposition decides whether the browser shows it or saves it, so
    // it follows the type rather than being fixed either way.
    const disposition = INLINE.has(type) ? "inline" : "attachment";

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": type,
        // The filename is user data from a mail header; quotes and newlines in it
        // would break the header, so it is stripped rather than trusted.
        "Content-Disposition": `${disposition}; filename="${name.replace(/["\r\n]/g, "")}"`,
        "Content-Length": String(bytes.byteLength),
        // Attachments are immutable but private: cached in the browser only.
        "Cache-Control": "private, max-age=600",
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Could not fetch that attachment.", { status: 502 });
  }
}
