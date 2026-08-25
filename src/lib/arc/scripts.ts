// Script drafts for approved ideas. Used by the manual pipeline route and by
// content workers that claim `draft_content`. Never publishes. Never runs on
// ideas that are still proposed: that is the human gate.

import { getIdeasByStatus, getScriptForIdea, insertScript } from "@/lib/arc/db";
import { callJSON } from "@/lib/arc/llm";
import { BCON } from "@/lib/arc/brand";
import { listKeywords } from "@/lib/market";

const [MIN, MAX] = BCON.video_len_s;

async function keywordLine(): Promise<string> {
  const bank = await listKeywords();
  if ("error" in bank) return "";
  const use = bank.rows.filter((r) => r.status === "use").slice(0, 12);
  if (!use.length) return "";
  return `\nPhrases the buyer actually types (work these in, do not stuff):\n${use.map((r) => `- ${r.phrase}`).join("\n")}`;
}

async function systemPrompt(): Promise<string> {
  const keywords = await keywordLine();
  return `You are the head scriptwriter for BCON Club, an AI-native marketing brand.

Brand voice: ${BCON.voice}
Format: ${BCON.winning_format}
Video length: ${MIN}-${MAX} seconds
ICP: ${BCON.icp}
${keywords}

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
Caption ends with exactly one CTA (DM DEMO / Comment LEADS / Save this).
No em dashes.`;
}

interface ScriptResult {
  hook: string;
  body: string;
  on_screen_text: { t: number; text: string }[];
  caption: string;
  hashtags: string[];
  shot_list: { shot: number; description: string; duration_s: number }[];
}

export async function draftScriptsForApproved(limit = 8): Promise<{
  processed: number;
  scripts_created: number;
}> {
  const approved = await getIdeasByStatus("approved");
  if (!approved.length) return { processed: 0, scripts_created: 0 };

  const sys = await systemPrompt();
  let processed = 0;
  let scripts_created = 0;

  for (const idea of approved) {
    if (processed >= limit) break;
    const existing = await getScriptForIdea(idea.id);
    if (existing) continue;

    const trend = (idea.trends ?? {}) as { title?: string; url?: string };
    processed++;

    try {
      const result = await callJSON<ScriptResult>(
        sys,
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
    } catch (e) {
      console.error(`[script] error for idea ${idea.id}:`, e);
    }
  }

  return { processed, scripts_created };
}
