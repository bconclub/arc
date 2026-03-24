import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODELS = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-20250514",
} as const;

const ICP_CONTEXT = `Our ICP: Solo founders, coaching academies, clinics (dental/skin/physio), real estate agents, tutoring centers. Revenue 5-15L/month. India-based. They lose leads because they don't reply to WhatsApp inquiries fast enough or follow up properly. They're not tech-savvy but hungry to grow.`;

const PILLARS = `Content Pillars:
- Pain Points (red): Content about problems our ICP faces — lost leads, no follow-up, manual processes
- Marketing Tips (blue): Actionable tactics — WhatsApp automations, follow-up systems, demo booking hacks
- Build Journey (green): Raw build-in-public content — what we're building, wins, failures, learnings
- Client Results (orange): Case studies, before/after, social proof from real clients`;

const VOICE = `Writing voice: Thanzeel's style is raw, vulnerable, build-in-public, first person. Short punchy sentences. No corporate fluff. No motivational clichés. Conversational. Like texting a friend who happens to be building something real. Every post ends with a CTA like "DM me DEMO" or "Comment LEADS" or "Save this for later".`;

const SYSTEM_PROMPTS: Record<string, string> = {
  "generate-topics": `You are a content strategist for Koex, a GTM command center for solo founders.
${ICP_CONTEXT}
${PILLARS}
Generate topic ideas that would make solo founders stop scrolling. Each topic should be specific, provocative, or deeply relatable. Avoid generic advice.
Respond with ONLY a valid JSON array of objects with fields: title (string), pillar (one of "Pain Points", "Marketing Tips", "Build Journey", "Client Results"), platform (one of "LinkedIn", "Instagram", "Twitter", "All"). No markdown, no explanation, just the JSON array.`,

  "write-post": `You are a ghostwriter for Thanzeel, founder of Koex.
${ICP_CONTEXT}
${VOICE}
Platform-specific guidelines:
- LinkedIn: Longer form storytelling (800-1200 chars). Hook in first line. Line breaks between sentences. End with CTA.
- Instagram: Punchier, carousel-friendly. Each point on its own line. Use "→" for lists. Max 400 chars for caption.
- Twitter: Tight single banger or thread format. Max 280 chars per tweet. If thread, number them 1/ 2/ 3/.
Write the full post copy. No meta-commentary. Just the post ready to publish.`,

  "analyze-metrics": `You are a brutally honest growth advisor for Koex, a solo-founder GTM tool.
${ICP_CONTEXT}
Analyze the provided metrics data. Be specific with numbers. Don't sugarcoat.
Structure: Start with a 1-line verdict. Then list what's working (with evidence). Then what's not (with evidence). Then 3 specific action items for this week. Keep it under 300 words.`,

  "generate-dms": `You are an outreach specialist for Koex.
${ICP_CONTEXT}
Write cold DM scripts that are:
- Short (under 50 words each message)
- Value-first, not pitch-first
- Specific to the target type
- Designed to get a reply, not close a deal
- Natural and conversational, not templated
Respond with ONLY a valid JSON array of objects with fields: target (string), platform (string), opener (string - first message), body (string - follow up if they reply), cta (string - the ask). No markdown, just the JSON array.`,

  "daily-briefing": `You are Thanzeel's AI chief of staff at Koex.
${ICP_CONTEXT}
Generate a concise morning briefing. Structure:
🎯 TOP PRIORITY (the one thing that matters most today)
📊 METRICS CHECK (quick read on the numbers, any alerts)
📝 CONTENT (what's scheduled, any gaps)
📞 FOLLOW-UPS (leads to chase based on recent activity)
💪 SPRINT CHECK (Day X of 90 context, pace check)
Keep it actionable. No fluff. Under 250 words. Talk directly to Thanzeel.`,
};

// Streaming actions
const STREAMING_ACTIONS = new Set(["write-post", "analyze-metrics", "daily-briefing"]);

export async function POST(req: NextRequest) {
  try {
    const { action, payload } = await req.json();

    if (!action || !SYSTEM_PROMPTS[action]) {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    const model = STREAMING_ACTIONS.has(action) ? MODELS.sonnet : MODELS.haiku;
    const modelOverride = payload?.model;
    const finalModel = modelOverride === "haiku" ? MODELS.haiku : modelOverride === "sonnet" ? MODELS.sonnet : model;

    // Build user message based on action
    let userMessage = "";

    switch (action) {
      case "generate-topics": {
        const existing = (payload.existingTopics as string[]) || [];
        userMessage = `Generate 5 fresh content topic ideas.\n\nExisting topics to avoid duplicating:\n${existing.join("\n") || "None yet"}\n\nFocus on topics for: ${payload.platform || "All"} platform.`;
        break;
      }
      case "write-post": {
        userMessage = `Write a ${payload.format || "Text Post"} for ${payload.platform || "LinkedIn"}.\n\nTopic: ${payload.topic}\nPillar: ${payload.pillar}\n\nWrite the post now.`;
        break;
      }
      case "analyze-metrics": {
        userMessage = `Analyze these metrics:\n\n${JSON.stringify(payload.metrics, null, 2)}\n\nMetric change history:\n${JSON.stringify(payload.history?.slice(-20), null, 2)}\n\nRecent activity log:\n${JSON.stringify(payload.logEntries?.slice(-10), null, 2)}`;
        break;
      }
      case "generate-dms": {
        userMessage = `Generate 3 cold DM scripts for: ${payload.targetType || "coaching academy owners"}\nPlatforms: LinkedIn and WhatsApp\nContext: ${payload.context || "Outreach for Koex - WhatsApp automation for lead management"}`;
        break;
      }
      case "daily-briefing": {
        userMessage = `Generate my morning briefing.\n\nSprint: Day ${payload.sprintDay || "?"} of 90\nToday's targets: ${JSON.stringify(payload.targets)}\nCurrent metrics snapshot: ${JSON.stringify(payload.metrics)}\nSchedule: ${JSON.stringify(payload.schedule)}\nRecent log: ${JSON.stringify(payload.recentLog?.slice(-5))}`;
        break;
      }
    }

    if (STREAMING_ACTIONS.has(action)) {
      const stream = client.messages.stream({
        model: finalModel,
        max_tokens: 1024,
        system: SYSTEM_PROMPTS[action],
        messages: [{ role: "user", content: userMessage }],
      });

      const readable = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        },
      });

      return new Response(readable, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
      });
    } else {
      const response = await client.messages.create({
        model: finalModel,
        max_tokens: 1024,
        system: SYSTEM_PROMPTS[action],
        messages: [{ role: "user", content: userMessage }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";

      try {
        const parsed = JSON.parse(text);
        return Response.json({ data: parsed });
      } catch {
        return Response.json({ data: text });
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "AI request failed";
    console.error("AI route error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
