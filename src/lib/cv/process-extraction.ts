import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { extractCvText } from "./extract-text";
import { extractStructuredCv } from "./extract-structured";
import { estimateCostUsd } from "@/lib/ai/cost";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { env } from "@/lib/config/env";

export type ProcessExtractionResult = { ok: true } | { ok: false; error: string };

/**
 * Runs Stage 1 (Section 6) end to end for one uploaded CV: raw text →
 * structured JSON → cv_extracted_data, with uploaded_cvs.status tracking
 * progress throughout. `supabase` should be the caller's RLS-scoped client
 * (the user owns uploaded_cvs/cv_extracted_data, so their own session is
 * sufficient); ai_usage is written separately with the service-role client
 * because — like payments — it's a record the user can read about
 * themselves but should never be able to write or falsify directly.
 */
export async function processCvExtraction(
  supabase: SupabaseClient<Database>,
  uploadedCvId: string,
  fileType: "pdf" | "docx",
  bytes: Buffer
): Promise<ProcessExtractionResult> {
  await supabase.from("uploaded_cvs").update({ status: "extracting" }).eq("id", uploadedCvId);

  try {
    const text = await extractCvText(fileType, bytes);
    const extraction = await extractStructuredCv(text);

    const { error: upsertError } = await supabase.from("cv_extracted_data").upsert(
      {
        uploaded_cv_id: uploadedCvId,
        structured_data: extraction.structuredData,
        extraction_model: extraction.model,
        reviewed_by_user: false,
      },
      { onConflict: "uploaded_cv_id" }
    );
    if (upsertError) throw new Error(upsertError.message);

    await supabase.from("uploaded_cvs").update({ status: "extracted" }).eq("id", uploadedCvId);

    const serviceClient = createServiceRoleClient();
    await serviceClient.from("ai_usage").insert({
      optimization_job_id: null, // no job exists yet at extraction time — see ARCHITECTURE.md
      stage: "extraction",
      provider: env.ai.provider(),
      model: extraction.model,
      input_tokens: extraction.inputTokens,
      output_tokens: extraction.outputTokens,
      estimated_cost_usd: estimateCostUsd(
        extraction.model,
        extraction.inputTokens,
        extraction.outputTokens
      ),
    });

    return { ok: true };
  } catch (err) {
    await supabase.from("uploaded_cvs").update({ status: "failed" }).eq("id", uploadedCvId);
    return { ok: false, error: err instanceof Error ? err.message : "Extraction failed." };
  }
}
