// AI provider abstraction (Section 14). Application code — the extraction,
// job-analysis, matching, gap-analysis, optimization, and QA stages built in
// later phases — calls only the AIProvider interface below. Swapping
// providers or models is an environment-variable change, never a code change.

export interface CompletionRequest {
  /** System-level instructions for this call (e.g. one of the versioned prompts in Section 24). */
  system?: string;
  /** The user-turn content — CV text, job description text, prior-stage output, etc. */
  prompt: string;
  /** Overrides AI_MODEL / AI_MODEL_FAST for this one call. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Ask the provider to return only JSON (used for structured extraction — see Section "structured outputs"). */
  jsonMode?: boolean;
}

export interface CompletionResult {
  text: string;
  provider: "anthropic" | "openai";
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AIProvider {
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

export type AIProviderName = "anthropic" | "openai";

/**
 * Returns the configured provider. Reads AI_PROVIDER once per call rather than
 * caching a singleton, so a changed env var takes effect without a redeploy
 * in environments that support runtime env updates.
 */
export async function getAIProvider(providerName?: AIProviderName): Promise<AIProvider> {
  const { env } = await import("@/lib/config/env");
  const name = providerName ?? env.ai.provider();

  switch (name) {
    case "anthropic": {
      const { AnthropicProvider } = await import("./providers/anthropic");
      return new AnthropicProvider();
    }
    case "openai": {
      const { OpenAIProvider } = await import("./providers/openai");
      return new OpenAIProvider();
    }
    default:
      throw new Error(`Unknown AI_PROVIDER: ${name}`);
  }
}
