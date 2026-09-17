/**
 * AI Insight configuration — heuristic always on; LLM optional via API key.
 */
export const AI_CONFIG = {
  enabled: process.env.AI_INSIGHTS_ENABLED !== "false",
  provider: process.env.AI_PROVIDER ?? "heuristic",
  apiKey: process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
  model: process.env.AI_MODEL ?? "gpt-4o-mini",
  endpoint: process.env.AI_ENDPOINT ?? "https://api.openai.com/v1/chat/completions",
} as const;

export function isLlmConfigured(): boolean {
  return Boolean(AI_CONFIG.apiKey);
}
