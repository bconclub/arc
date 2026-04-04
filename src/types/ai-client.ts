// Types for AI client - safe to import in client components
// The actual implementation is in lib/ai-client.ts (server-side only)

export type AIModel = "claude" | "kimi";

export const MODEL_NAMES: Record<AIModel, string> = {
  claude: "Claude",
  kimi: "Kimi K2",
};

export const MODEL_DESCRIPTIONS: Record<AIModel, string> = {
  claude: "Claude Sonnet - Best for creative writing",
  kimi: "Kimi K2 - Long context, fast",
};
