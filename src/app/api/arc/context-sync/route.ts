// Refreshes agent_context from every configured source.
//
// GET  /api/arc/context-sync  — Vercel Cron (Bearer $CRON_SECRET, checked in middleware)
// POST /api/arc/context-sync  — manual refresh from a logged-in dashboard session
//
// The pullers live in lib/arc/context-sources so the morning brief can run them
// too. See that file for how a source is added.
import { syncAllSources } from "@/lib/arc/context-sources"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

async function runSync() {
  const results = await syncAllSources()
  const failed = results.filter((r) => !r.ok)
  return Response.json(
    { ok: failed.length === 0, results },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  )
}

/**
 * Same split as /api/ops/invoices/scan: GET is the machine door and carries
 * CRON_SECRET, POST is the human door and rides the session cookie. Keeping them
 * separate means the dashboard's refresh button never needs the cron secret.
 */
export async function GET() {
  return runSync()
}

export async function POST() {
  return runSync()
}
