import Anthropic from "@anthropic-ai/sdk";

// Strip injected env that breaks the SDK in some runtimes
delete process.env.ANTHROPIC_AUTH_TOKEN;
delete process.env.ANTHROPIC_BASE_URL;
delete process.env.ANTHROPIC_CUSTOM_HEADERS;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-6";

export async function callJSON<T = unknown>(
  system: string,
  user: string,
  max_tokens = 1024,
): Promise<T> {
  const fullSystem =
    system + "\n\nRespond with valid JSON only. No explanation, no markdown fences.";

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens,
      system: fullSystem,
      messages: [{ role: "user", content: user }],
    });

    let text = (response.content[0] as { text: string }).text.trim();

    // Strip accidental markdown fences
    if (text.startsWith("```")) {
      text = text.split("```")[1] ?? "";
      if (text.startsWith("json")) text = text.slice(4);
      text = text.trim();
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      if (attempt === 2) throw new Error(`Claude returned invalid JSON: ${text.slice(0, 200)}`);
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error("callJSON exhausted retries");
}
