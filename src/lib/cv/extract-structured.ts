import { getAIProvider } from "@/lib/ai/provider";
import {
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_PROMPT_VERSION,
} from "@/lib/ai/prompts/extraction";
import { parseJsonCompletion } from "@/lib/ai/json";
import { env } from "@/lib/config/env";
import type { CvStructuredData } from "@/types/cv";

export interface ExtractionResult {
  structuredData: CvStructuredData;
  model: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
}

export async function extractStructuredCv(rawCvText: string): Promise<ExtractionResult> {
  const provider = await getAIProvider();

  const result = await provider.complete({
    system: EXTRACTION_SYSTEM_PROMPT,
    prompt: rawCvText,
    model: env.ai.fastModel(), // extraction is well-specified; the cheaper/faster model is enough — see ARCHITECTURE.md § AI architecture
    jsonMode: true,
    maxTokens: 4096,
    temperature: 0, // extraction should be deterministic, not creative
  });

  const structuredData = parseJsonCompletion<CvStructuredData>(result.text);

  return {
    structuredData,
    model: result.model,
    promptVersion: EXTRACTION_PROMPT_VERSION,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}
