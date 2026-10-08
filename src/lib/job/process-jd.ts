import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { extractJobDescription } from "./extract-jd";
import { estimateCostUsd } from "@/lib/ai/cost";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { env } from "@/lib/config/env";

export type ProcessJdResult = { ok: true } | { ok: false; error: string };

/**
 * Runs Stage 2 (Section 4/6) for one job_descriptions row: raw pasted text →
 * structured requirements, written back onto that same row. Like CV
 * extraction, ai_usage is written with the service-role client — see
 * ARCHITECTURE.md and src/lib/cv/process-extraction.ts for why.
 */
export async function processJobDescription(
  supabase: SupabaseClient<Database>,
  jobDescriptionId: string,
  rawText: string
): Promise<ProcessJdResult> {
  try {
    const analysis = await extractJobDescription(rawText);

    const { error } = await supabase
      .from("job_descriptions")
      .update({ extracted_data: analysis.extractedData, extraction_model: analysis.model })
      .eq("id", jobDescriptionId);
    if (error) throw new Error(error.message);

    const serviceClient = createServiceRoleClient();
    await serviceClient.from("ai_usage").insert({
      optimization_job_id: null, // no optimization_job exists yet at targeting time
      stage: "job_analysis",
      provider: env.ai.provider(),
      model: analysis.model,
      input_tokens: analysis.inputTokens,
      output_tokens: analysis.outputTokens,
      estimated_cost_usd: estimateCostUsd(
        analysis.model,
        analysis.inputTokens,
        analysis.outputTokens
      ),
    });

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Job description analysis failed.",
    };
  }
}
