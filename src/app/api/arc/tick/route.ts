// Always-on GTM tick.
//
// GET  /api/arc/tick   Vercel Cron (Bearer $CRON_SECRET, checked in middleware)
// POST /api/arc/tick   logged-in session, optional { fillIdeas: true }
import { NextRequest } from "next/server";
import { runTick } from "@/lib/arc/tick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const result = await runTick();
  return Response.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const result = await runTick({ fillIdeas: body.fillIdeas === true });
  return Response.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
