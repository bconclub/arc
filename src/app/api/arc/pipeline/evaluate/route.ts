import { getUnevaluatedTrends, insertIdea } from "@/lib/arc/db";
import { callJSON } from "@/lib/arc/llm";
import { BCON } from "@/lib/arc/brand";

export const maxDuration = 300;

const MIN_FIT_SCORE = 40;
const TOP_N = 5;

const SYSTEM = `You are the content strategist for BCON Club.

BCON profile:
- Positioning: ${BCON.positioning}
- Winning format: ${BCON.winning_format}
- Voice: ${BCON.voice}
- ICP: ${BCON.icp}

Fit signals (what makes a trend worth actioning):
${BCON.fit_signals.map((s) => `  + ${s}`).join("\n")}

Anti-signals (automatic disqualifiers):
${BCON.anti_signals.map((s) => `  - ${s}`).join("\n")}

Return JSON with exactly these keys:
{
  "fit_score": <0-100 integer>,
  "rationale": "<1-2 sentence explanation>",
  "angle": "<specific tutorial angle BCON should take>"
}

Be harsh. Most trends should score under 40. A score above 70 means we post today.`;

interface EvalResult {
  fit_score: number;
  rationale: string;
  angle: string;
}

export async function POST() {
  const trends = await getUnevaluatedTrends(30);
  if (!trends.length) {
    return Response.json({ evaluated: 0, ideas_created: 0 });
  }

  console.log(`[evaluate] scoring ${trends.length} trends`);

  const scored: Array<{
    trend: (typeof trends)[0];
    fit_score: number;
    rationale: string;
    angle: string;
    rank: number;
  }> = [];

  for (const trend of trends) {
    try {
      const result = await callJSON<EvalResult>(
        SYSTEM,
        `Title: ${trend.title}\nURL: ${trend.url}\nSource: ${JSON.stringify(trend.raw)}`,
        512,
      );

      const fit_score = Number(result.fit_score ?? 0);
      const velocity = Number(trend.velocity ?? 0);
      const rank = fit_score * Math.log(velocity + 1);

      scored.push({ trend, fit_score, rationale: result.rationale, angle: result.angle, rank });
    } catch (e) {
      console.error(`[evaluate] LLM error for trend ${trend.id}:`, e);
    }
  }

  const qualified = scored
    .filter((s) => s.fit_score >= MIN_FIT_SCORE)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, TOP_N);

  let ideas_created = 0;
  for (const item of qualified) {
    try {
      await insertIdea({
        trend_id: item.trend.id,
        fit_score: item.fit_score,
        rationale: item.rationale,
        angle: item.angle,
      });
      ideas_created++;
      console.log(`[evaluate] idea, score=${item.fit_score}, ${item.trend.title.slice(0, 60)}`);
    } catch (e) {
      console.error("[evaluate] insertIdea error:", e);
    }
  }

  const summary = { evaluated: scored.length, ideas_created };
  console.log("[evaluate] done", summary);
  return Response.json(summary);
}
