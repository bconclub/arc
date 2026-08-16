import Anthropic from "@anthropic-ai/sdk";
import { HAIKU, SONNET } from "@/lib/llm/models";
import type { Intent, IntentAction } from "./rules";

/**
 * The model rung of the chat parser: Haiku by default, Sonnet only when the
 * turn is genuinely tangled (several brands or several actions in one
 * breath), never Opus. Every failure path returns null and the caller falls
 * back to the rules reading — a dead key degrades the chat, it never breaks
 * it.
 */

delete process.env.ANTHROPIC_AUTH_TOKEN;
delete process.env.ANTHROPIC_BASE_URL;
delete process.env.ANTHROPIC_CUSTOM_HEADERS;

export function llmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const ACTIONS: IntentAction[] = [
  "mark_done", "mark_paid", "set_status", "add_note",
  "create_payment", "create_proposal", "question", "unknown",
];

const SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: ACTIONS },
    target: { type: ["string", "null"], enum: ["project", "payment", "proposal", null] },
    status: { type: ["string", "null"] },
    amount: { type: ["number", "null"] },
    brand: { type: ["string", "null"] },
    subject: { type: "string" },
    complex: { type: "boolean" },
  },
  required: ["action", "target", "status", "amount", "brand", "subject", "complex"],
  additionalProperties: false,
} as const;

const SYSTEM = `You turn one short operations update from a studio founder into a structured intent.

The founder runs BCON, a design/marketing studio. Updates are about client work:
projects finishing, payments landing, proposals going out, things going on hold.

- action: what the update does. "question" for anything asking rather than telling.
- brand: the client/brand name mentioned, exactly as written, or null.
- subject: the words naming the specific work or payment, stripped of filler.
- amount: rupees as a number. "80k" is 80000, "1.2L" is 120000 (lakh), "1cr" is 10000000.
- status: only for set_status — one of active, waiting, parked, done.
- complex: true ONLY if the message contains several distinct updates or several brands.

Read the conversation context: a short follow-up like "no, the exam platform one"
refines the previous message rather than starting a new topic — resolve it against
that context and produce the corrected intent.

Never invent a brand, an amount, or a status that the words do not state.`;

export type LlmIntent = Intent & { brand: string | null; complex: boolean };

async function call(model: string, prompt: string): Promise<LlmIntent | null> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason === "refusal") return null;
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return null;
  const parsed = JSON.parse(text.text) as Omit<LlmIntent, "raw" | "pct">;
  return { ...parsed, pct: null, raw: "" };
}

export async function parseWithModel(
  text: string,
  context: {
    brandNames: string[];
    recentMessages: { role: string; content: string }[];
    pendingIntent: unknown | null;
  },
): Promise<LlmIntent | null> {
  if (!llmConfigured()) return null;

  const prompt = [
    `Known brands (match against these, including partial/alias spellings):`,
    context.brandNames.join(", ") || "(none registered)",
    context.recentMessages.length
      ? `\nConversation so far:\n${context.recentMessages.map((m) => `${m.role}: ${m.content}`).join("\n")}`
      : "",
    context.pendingIntent
      ? `\nThere is a pending unconfirmed intent this message may be refining:\n${JSON.stringify(context.pendingIntent)}`
      : "",
    `\nNew message: ${text}`,
  ].join("\n");

  try {
    const first = await call(HAIKU, prompt);
    if (!first) return null;
    if (first.complex) {
      // One escalation, then live with the answer — a loop here is a bill.
      const second = await call(SONNET, prompt).catch(() => null);
      return second ?? first;
    }
    return { ...first, raw: text };
  } catch {
    // Out of credit, network down, model error: the rules rung already ran.
    return null;
  }
}
