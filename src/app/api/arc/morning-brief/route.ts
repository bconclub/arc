// The 7am routine the growth team reads.
//
// GET  /api/arc/morning-brief  — Vercel Cron (Bearer $CRON_SECRET, checked in middleware)
// POST /api/arc/morning-brief  — regenerate on demand from a logged-in session
//
// Order matters and is enforced here rather than by cron scheduling: refresh the
// sources, then brief on what was just written. Two separate crons racing would
// eventually produce a brief describing yesterday's numbers under today's date,
// and nobody would notice for a week.
import { syncAllSources } from "@/lib/arc/context-sources"
import { generateMorningBriefs, istDate } from "@/lib/arc/morning-brief"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Sync plus one model call per brand. 60s is the Vercel ceiling on this plan and
// is comfortable for a handful of brands; revisit if the brand list grows.
export const maxDuration = 60

async function run() {
  const sync = await syncAllSources()
  const briefs = await generateMorningBriefs()

  const ok = briefs.some((b) => b.ok)
  return Response.json(
    { ok, date: istDate(), sync, briefs },
    // 200 even when nothing briefed: the body carries the reason, and a 500 here
    // would just make Vercel retry a run that is going to fail identically.
    { status: 200, headers: { "Cache-Control": "no-store" } },
  )
}

export async function GET() {
  return run()
}

export async function POST() {
  return run()
}
