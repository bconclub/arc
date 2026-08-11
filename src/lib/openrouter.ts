// OpenRouter client, one gateway to many models (OpenAI, Anthropic, Google, etc.)
// SERVER-SIDE ONLY. Uses the OpenAI-compatible chat/completions endpoint.
//
// Env: OPENROUTER_API_KEY (in .env.local locally, Vercel env in prod).
// Default model is overridable per call so ARC features can pick the right model.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const OPENROUTER_MODELS = {
  // Sensible defaults, swap freely, OpenRouter routes to the provider.
  smart: "anthropic/claude-sonnet-4.6",
  fast: "openai/gpt-4o-mini",
  gpt4o: "openai/gpt-4o",
} as const;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterOptions {
  model?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

function getKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  return key;
}

// Non-streaming chat completion. Returns the assistant text.
export async function openrouterChat(opts: OpenRouterOptions): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/json",
      // OpenRouter attribution headers (optional but recommended).
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://arc-liard-two.vercel.app",
      "X-Title": "ARC",
    },
    body: JSON.stringify({
      model: opts.model || OPENROUTER_MODELS.smart,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 1000,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${detail.slice(0, 200)}`);
  }

  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

// Streaming chat completion. Yields text chunks as they arrive (SSE).
export async function* openrouterStream(opts: OpenRouterOptions): AsyncGenerator<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://arc-liard-two.vercel.app",
      "X-Title": "ARC",
    },
    body: JSON.stringify({
      model: opts.model || OPENROUTER_MODELS.smart,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 1000,
      stream: true,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${detail.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // partial JSON line, ignore, will complete next chunk
      }
    }
  }
}
