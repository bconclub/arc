import { getEnabledSources, upsertTrend } from "@/lib/arc/db";
import { SOURCE_MAP } from "@/lib/arc/sources";

export const maxDuration = 300;

export async function POST() {
  const sources = await getEnabledSources();
  if (!sources.length) {
    return Response.json({ pulled: 0, saved: 0, skipped: 0 });
  }

  let pulled = 0;
  let saved = 0;
  let skipped = 0;

  for (const row of sources) {
    const fetcher = SOURCE_MAP[row.kind];
    if (!fetcher) { skipped++; continue; }

    console.log(`[aggregate] fetching ${row.kind}/${row.handle ?? "default"}`);
    let trends;
    try {
      trends = await fetcher(row);
    } catch (e) {
      console.error(`[aggregate] ${row.kind} error:`, e);
      skipped++;
      continue;
    }

    pulled += trends.length;

    for (const t of trends) {
      const result = await upsertTrend({
        source_id: row.id,
        external_id: t.external_id,
        title: t.title,
        url: t.url,
        raw: t.raw,
        velocity: t.velocity,
      });
      if (result) saved++;
    }
  }

  const summary = { pulled, saved, skipped };
  console.log("[aggregate] done", summary);
  return Response.json(summary);
}
