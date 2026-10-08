import { getAIProvider } from "@/lib/ai/provider";
import {
  JOB_ANALYSIS_SYSTEM_PROMPT,
  JOB_ANALYSIS_PROMPT_VERSION,
} from "@/lib/ai/prompts/job-analysis";
import { parseJsonCompletion } from "@/lib/ai/json";
import { env } from "@/lib/config/env";
import type { JobDescriptionExtractedData } from "@/types/job";

export interface JobAnalysisResult {
  extractedData: JobDescriptionExtractedData;
  model: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
}

export async function extractJobDescription(rawJdText: string): Promise<JobAnalysisResult> {
  const provider = await getAIProvider();

  const result = await provider.complete({
    system: JOB_ANALYSIS_SYSTEM_PROMPT,
    prompt: rawJdText,
    model: env.ai.fastModel(), // structured categorization, not creative writing — see ARCHITECTURE.md § AI architecture
    jsonMode: true,
    maxTokens: 4096,
    temperature: 0,
  });

  const extractedData = parseJsonCompletion<JobDescriptionExtractedData>(result.text);

  return {
    extractedData,
    model: result.model,
    promptVersion: JOB_ANALYSIS_PROMPT_VERSION,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}
