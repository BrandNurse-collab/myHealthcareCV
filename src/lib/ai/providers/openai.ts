import type { AIProvider, CompletionRequest, CompletionResult } from "../provider";
import { env } from "@/lib/config/env";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

export class OpenAIProvider implements AIProvider {
  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const model = request.model ?? env.ai.model();

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.ai.apiKey()}`,
      },
      body: JSON.stringify({
        model,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 4096,
        response_format: request.jsonMode ? { type: "json_object" } : undefined,
        messages: [
          ...(request.system ? [{ role: "system", content: request.system }] : []),
          { role: "user", content: request.prompt },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${body}`);
    }

    const data = await response.json();

    return {
      text: data.choices?.[0]?.message?.content ?? "",
      provider: "openai",
      model,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  }
}
