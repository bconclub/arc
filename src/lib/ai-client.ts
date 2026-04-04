// Model-agnostic AI client for ARC
// Supports: Claude (Anthropic) and Kimi K2 (Moonshot)

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type AIModel = "claude" | "kimi";

interface CallAIOptions {
  model?: AIModel;
  systemPrompt: string;
  userMessage: string;
  max_tokens?: number;
  stream?: boolean;
}

// Non-streaming call
export async function callAI({
  model = "claude",
  systemPrompt,
  userMessage,
  max_tokens = 1000,
}: CallAIOptions): Promise<string> {
  if (model === "kimi") {
    const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.KIMI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "kimi-k2-0711-preview", // Kimi K2 model
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Kimi API error: ${error}`);
    }

    const data = await res.json();
    return data.choices[0]?.message?.content || "";
  }

  // Default: Claude
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

// Streaming call
export async function* callAIStream({
  model = "claude",
  systemPrompt,
  userMessage,
  max_tokens = 1000,
}: CallAIOptions): AsyncGenerator<string, void, unknown> {
  if (model === "kimi") {
    const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.KIMI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "kimi-k2-0711-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Kimi API error: ${error}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter(line => line.trim());

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
    return;
  }

  // Default: Claude streaming
  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
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

// Model display names
export const MODEL_NAMES: Record<AIModel, string> = {
  claude: "Claude",
  kimi: "Kimi K2",
};

// Model descriptions
export const MODEL_DESCRIPTIONS: Record<AIModel, string> = {
  claude: "Claude Sonnet - Best for creative writing",
  kimi: "Kimi K2 - Long context, fast",
};
