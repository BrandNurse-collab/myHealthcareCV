// $ per 1M tokens. Verify against your provider's pricing page before relying
// on this for financial reporting (Section 14 / 29), and update it here —
// not scattered through the codebase — when prices change. Last checked
// against published Anthropic rates in Sept 2026.
const PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
};

/**
 * Providers publish dated snapshot names (e.g. "claude-haiku-4-5-20251001")
 * alongside the base name, so an exact-match lookup would silently price
 * every real call at $0. Match on the longest known base name instead.
 */
function findPricing(model: string) {
  const key = Object.keys(PRICING_PER_MILLION_TOKENS)
    .filter((k) => model === k || model.startsWith(`${k}-`))
    .sort((a, b) => b.length - a.length)[0];
  return key ? PRICING_PER_MILLION_TOKENS[key] : undefined;
}

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rate = findPricing(model);
  if (!rate) return 0; // unknown model: log 0 rather than guess — token counts are still recorded
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
}
