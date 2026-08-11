import { getIdeasByStatus, getScriptForIdea, insertScript } from "@/lib/arc/db";
import { callJSON } from "@/lib/arc/llm";
import { BCON } from "@/lib/arc/brand";

export const maxDuration = 300;

const [MIN, MAX] = BCON.video_len_s;

const SYSTEM = `You are the head scriptwriter for BCON Club, an AI-native marketing brand.

Brand voice: ${BCON.voice}
Format: ${BCON.winning_format}
Video length: ${MIN}-${MAX} seconds
ICP: ${BCON.icp}

Hook patterns that work for BCON:
${BCON.hook_patterns.map((p) => `  - ${p}`).join("\n")}

Return JSON with exactly these keys:
{
  "hook": "<first 3 seconds, one punchy sentence that stops the scroll>",
  "body": "<the how-to beats, numbered steps, 1 sentence each, fits ${MIN}-${MAX}s when spoken>",
  "on_screen_text": [{"t": 0, "text": "<overlay at 0s>"}, {"t": 5, "text": "<overlay at 5s>"}],
  "caption": "<Instagram/TikTok/LinkedIn caption, 80-150 words, ends with one CTA>",
  "hashtags": ["tag1", "tag2", "...up to 10"],
  "shot_list": [{"shot": 1, "description": "<what to film>", "duration_s": 5}]
}

Shot list must cover the full ${MIN}-${MAX}s. Be specific, what's on screen, what Z says.
Caption ends with exactly one CTA (DM DEMO / Comment LEADS / Save this).`;

interface ScriptResult {
  hook: string;
  body: string;
  on_screen_text: { t: number; text: string }[];
  caption: string;
  hashtags: string[];
  shot_list: { shot: number; description: string; duration_s: number }[];
}

export async function POST() {
  const approved = await getIdeasByStatus("approved");
  if (!approved.length) {
    return Response.json({ processed: 0, scripts_created: 0 });
  }

  let processed = 0;
  let scripts_created = 0;

  for (const idea of approved) {
    const existing = await getScriptForIdea(idea.id);
    if (existing) continue;

    const trend = idea.trends ?? {};
    console.log(`[script] generating for idea ${idea.id}: ${String(trend.title ?? "").slice(0, 60)}`);
    processed++;

    try {
      const result = await callJSON<ScriptResult>(
        SYSTEM,
        `Trend: ${trend.title ?? ""}\nURL: ${trend.url ?? ""}\nApproved angle: ${idea.angle ?? ""}`,
        1500,
      );

      await insertScript({
        idea_id: idea.id,
        hook: result.hook ?? "",
        body: result.body ?? "",
        on_screen_text: result.on_screen_text ?? [],
        caption: result.caption ?? "",
        hashtags: result.hashtags ?? [],
        shot_list: result.shot_list ?? [],
      });
      scripts_created++;
      console.log(`[script] created for idea ${idea.id}`);
    } catch (e) {
      console.error(`[script] error for idea ${idea.id}:`, e);
    }
  }

  return Response.json({ processed, scripts_created });
}
