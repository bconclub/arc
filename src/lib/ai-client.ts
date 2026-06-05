// Claude AI client for ARC
// Hardcoded to use Claude Sonnet 4.5
// ⚠️ SERVER-SIDE ONLY - Never import in client components!

import Anthropic from "@anthropic-ai/sdk";

// Guard: Prevent client-side usage
if (typeof window !== "undefined") {
  throw new Error(
    "ai-client.ts must ONLY be used server-side in API routes. " +
    "Client components should use fetch('/api/ai', ...) instead."
  );
}

// Strip inherited Anthropic env overrides so the SDK uses ONLY our x-api-key
// against the public API (some runtimes inject an OAuth token + proxy base URL).
delete process.env.ANTHROPIC_AUTH_TOKEN;
delete process.env.ANTHROPIC_BASE_URL;
delete process.env.ANTHROPIC_CUSTOM_HEADERS;
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: "https://api.anthropic.com",
});

// Model is hardcoded to Claude
export type AIModel = "claude";

interface CallAIOptions {
  systemPrompt: string;
  userMessage: string;
  max_tokens?: number;
  stream?: boolean;
}

// Non-streaming call
export async function callAI({
  systemPrompt,
  userMessage,
  max_tokens = 1000,
}: CallAIOptions): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

// Streaming call
export async function* callAIStream({
  systemPrompt,
  userMessage,
  max_tokens = 1000,
}: CallAIOptions): AsyncGenerator<string, void, unknown> {
  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

// Model display name (hardcoded to Claude)
export const MODEL_NAMES: Record<AIModel, string> = {
  claude: "Claude",
};

// Model descriptions
export const MODEL_DESCRIPTIONS: Record<AIModel, string> = {
  claude: "Claude Sonnet 4.5 - Best for creative writing",
};
