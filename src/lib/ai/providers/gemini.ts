import type { AIProvider, CompletionRequest, CompletionResult } from "../provider";
import { env } from "@/lib/config/env";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiPart {
  text?: string;
}

export class GeminiProvider implements AIProvider {
  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const model = request.model ?? env.ai.model();

    const body: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: request.prompt }] }],
      generationConfig: {
        temperature: request.temperature ?? 0.2,
        maxOutputTokens: request.maxTokens ?? 4096,
        ...(request.jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    };
    if (request.system) {
      body.systemInstruction = { parts: [{ text: request.system }] };
    }

    const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Header auth, not the ?key= query param — keeps the key out of
        // request logs that capture URLs but redact headers.
        "x-goog-api-key": env.ai.apiKey(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errBody}`);
    }

    const data = await response.json();

    if (data.promptFeedback?.blockReason) {
      // Gemini can return 200 OK with zero candidates when its safety
      // filters block the prompt — that's a real failure, not empty output.
      throw new Error(`Gemini blocked the request: ${data.promptFeedback.blockReason}`);
    }

    const parts: GeminiPart[] = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? "").join("");

    return {
      text,
      provider: "gemini",
      model,
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
}
