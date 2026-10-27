import type { AIProvider, CompletionRequest, CompletionResult } from "./provider";

// Transient failures worth a second attempt: rate limits, server-side
// overload, and "overloaded" (Anthropic's 529). All three providers throw
// errors shaped "<Provider> API error <status>: <body>" (see
// providers/anthropic.ts, openai.ts, gemini.ts) — matching on that shared
// format means retry logic doesn't need to know which provider is active.
const RETRYABLE_STATUS = /API error (429|500|502|503|504|529)\b/;

// A parse failure can be a genuinely bad prompt/response shape, or it can
// be an overloaded backend truncating output mid-structure (the same
// condition that produces a clean 503 elsewhere) — retrying costs one
// cheap extra call and has repeatedly turned out to be the latter in
// practice. parseJsonCompletion (see ../json.ts) throws exactly this text.
const RETRYABLE_MESSAGE = "AI call did not return valid JSON.";

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return RETRYABLE_STATUS.test(err.message) || err.message === RETRYABLE_MESSAGE;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls provider.complete(), retrying up to `maxRetries` times (3 attempts
 * total by default) with short exponential backoff on transient failures
 * only. A non-retryable error (bad request, auth failure, unknown
 * AI_PROVIDER) throws immediately on the first attempt — retrying those
 * would just burn three calls to fail the same way three times.
 */
export async function completeWithRetry(
  provider: AIProvider,
  request: CompletionRequest,
  maxRetries = 2
): Promise<CompletionResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await provider.complete(request);
    } catch (err) {
      if (attempt >= maxRetries || !isRetryable(err)) {
        throw err;
      }
      const delayMs = 1000 * 2 ** attempt; // 1s, then 2s
      console.error(
        `AI call failed on attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${delayMs}ms:`,
        err instanceof Error ? err.message : err
      );
      await sleep(delayMs);
    }
  }
}
