import type { AIProvider, CompletionRequest, CompletionResult } from "../provider";
import { env } from "@/lib/config/env";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export class AnthropicProvider implements AIProvider {
  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const model = request.model ?? env.ai.model();

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ai.apiKey(),
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.2,
        system: request.jsonMode
          ? `${request.system ?? ""}\n\nRespond with ONLY valid JSON. No prose, no markdown fences.`
          : request.system,
        messages: [{ role: "user", content: request.prompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${body}`);
    }

    const data = await response.json();
    const text = (data.content ?? [])
      .filter((block: { type: string }) => block.type === "text")
      .map((block: { text: string }) => block.text)
      .join("");

    return {
      text,
      provider: "anthropic",
      model,
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    };
  }
}
