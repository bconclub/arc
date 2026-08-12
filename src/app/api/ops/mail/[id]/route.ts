import { NextRequest, NextResponse } from "next/server";
import { getMail, gmailConfigured } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Ctx = { params: { id: string } };

/** GET /api/ops/mail/{id} : one message, with its body and attachment list. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!gmailConfigured()) {
    return NextResponse.json({ configured: false, detail: "Gmail is not connected.", message: null });
  }
  try {
    return NextResponse.json({ configured: true, error: null, message: await getMail(ctx.params.id) });
  } catch (e) {
    return NextResponse.json({
      configured: true,
      error: e instanceof Error ? e.message : "Could not read that message.",
      message: null,
    });
  }
}
