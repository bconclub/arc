// On-demand content idea engine. Reads the current feed cache, asks Claude
// (Haiku, cheap) for the top ideas to post about, scored against BCON fit,
// and persists them as trends+ideas rows so the ARC Agent page can show them.
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { readSignalsCache } from "@/lib/arc/rss";
import { recordUsage } from "@/lib/arc/usage";

const IDEA_MODEL = "claude-haiku-4-5-20251001";

const BCON = `BCON Club / PROXe, founder Thanzeel (Z). We help SMBs go AI-native in marketing. PROXe = done-for-you conversational AI that never drops a lead (listens across WhatsApp, IG, web, email, voice; warms leads, books calls). BCON Club = teach businesses to build with AI. Voice: lowercase, first-person, hook-first, no em dashes, no buzzwords, story-led. Content pillars: (1) pain points, leads lost to slow follow-up, (2) build-in-public / AI-native journey, (3) practical marketing+AI tips, (4) client results. ICP: solo founders, clinics, coaching academies, real estate, tutoring centers in India.`;

export interface GeneratedIdea {
  title: string;
  angle: string;
  rationale: string;
  fit_score: number;
  source_url: string;
  source_title: string;
}

// One cheap Haiku call → top N ideas from the latest signals.
export async function generateTopIdeas(limit = 8): Promise<GeneratedIdea[]> {
  const signals = (await readSignalsCache()) || [];
  if (signals.length === 0) return [];

  const pool = signals
    .slice(0, 25)
    .map((s, i) => `${i + 1}. ${s.title}, ${(s.snippet || "").slice(0, 140)}`)
    .join("\n");

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: "https://api.anthropic.com" });
  const sys = `You are the content strategist for:\n${BCON}\n\nFrom the trend list, choose the ${limit} BEST ideas for this founder to post about THIS WEEK. For each return: a punchy post "title" (the hook, in our lowercase voice), an "angle" (how we make it ours, one sentence), a "rationale" (why it lands with our ICP, one sentence), a "fit_score" 0-100, and "source_index" (the trend number it came from). Prefer ideas mapping to our 4 pillars + ICP. Return ONLY a valid JSON array, no prose.`;

  const resp = await anthropic.messages.create({
    model: IDEA_MODEL,
    max_tokens: 1600,
    system: sys,
    messages: [{ role: "user", content: `Trends:\n${pool}\n\nReturn the top ${limit} ideas as a JSON array.` }],
  });
  await recordUsage(IDEA_MODEL, resp.usage?.input_tokens || 0, resp.usage?.output_tokens || 0, "generate-ideas");

  const text = resp.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  let arr: Array<Record<string, unknown>> = [];
  try {
    const m = text.match(/\[[\s\S]*\]/);
    arr = JSON.parse(m ? m[0] : text);
  } catch {
    return [];
  }

  return arr.slice(0, limit).map((o) => {
    const idx = (Number(o.source_index) || 1) - 1;
    const sig = signals[idx] || signals[0];
    return {
      title: String(o.title || sig.title),
      angle: String(o.angle || ""),
      rationale: String(o.rationale || ""),
      fit_score: Math.round(Number(o.fit_score) || 50),
      source_url: sig.url,
      source_title: sig.title,
    };
  });
}

// Replace the current 'proposed' ideas with a fresh batch. Approved/rejected
// ideas are left untouched. Each idea links a trends row for the existing UI.
export async function regenerateProposedIdeas(limit = 8): Promise<number> {
  const ideas = await generateTopIdeas(limit);
  if (!ideas.length) return 0;

  await supabaseAdmin.from("ideas").delete().eq("status", "proposed");

  for (const idea of ideas) {
    const { data: trend } = await supabaseAdmin
      .from("trends")
      .insert({
        external_id: `feed:${idea.source_url}`,
        title: idea.title,
        url: idea.source_url,
        velocity: idea.fit_score,
        raw: { angle: idea.angle, source_title: idea.source_title, source: "feed" },
      })
      .select("id")
      .single();
    if (trend?.id) {
      await supabaseAdmin.from("ideas").insert({
        trend_id: trend.id,
        fit_score: idea.fit_score,
        rationale: idea.rationale,
        angle: idea.angle,
        status: "proposed",
      });
    }
  }
  return ideas.length;
}
