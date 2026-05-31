// Types for AI client - safe to import in client components
// The actual implementation is in lib/ai-client.ts (server-side only)

// Hardcoded to Claude only
export type AIModel = "claude";

export const MODEL_NAMES: Record<AIModel, string> = {
  claude: "Claude",
};

export const MODEL_DESCRIPTIONS: Record<AIModel, string> = {
  claude: "Claude Sonnet 4.5 - Best for creative writing",
};
