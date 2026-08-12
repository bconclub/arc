import { NextRequest, NextResponse } from "next/server";
import { listMail, gmailConfigured } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

/**
 * GET /api/ops/mail?q=...&max=25
 *
 * Mail for a person to read, as opposed to the scan route which is a machine
 * parsing it. The default query is deliberately wide: anything with an
 * attachment. Narrowing it here would hide the mail you are trying to find.
 */
export async function GET(req: NextRequest) {
  if (!gmailConfigured()) {
    return NextResponse.json({
      configured: false,
      detail: "Not connected. Missing GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET or GMAIL_REFRESH_TOKEN.",
      messages: [],
    });
  }

  const q = req.nextUrl.searchParams.get("q") || "has:attachment";
  const max = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("max")) || 25));

  try {
    return NextResponse.json({ configured: true, error: null, messages: await listMail(q, max) });
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: e instanceof Error ? e.message : "Could not read mail.", messages: [] },
      { status: 200 },
    );
  }
}
