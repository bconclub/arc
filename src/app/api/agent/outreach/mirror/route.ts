import { NextRequest, NextResponse } from "next/server";
import { checkIngestAuth, authError } from "@/lib/ingest-auth";
import { backfillCallsToProxe } from "@/lib/proxe-outbound-mirror";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Catch-up for the ARC -> PROXe outbound mirror. Bearer ARC_INGEST_SECRET.
 * Body: { since: ISO date }. Re-mirrors every ARC call message since then;
 * idempotent, so running it twice changes nothing.
 */
export async function POST(req: NextRequest) {
  const auth = checkIngestAuth(req);
  if (!auth.ok) return authError(auth);
  const body = await req.json().catch(() => null);
  const since = typeof body?.since === "string" && Number.isFinite(Date.parse(body.since)) ? body.since : null;
  if (!since) return NextResponse.json({ error: "since (ISO date) required" }, { status: 400 });
  return NextResponse.json(await backfillCallsToProxe(since));
}
