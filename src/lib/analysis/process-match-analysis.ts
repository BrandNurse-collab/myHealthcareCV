import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { runMatchAnalysis, type MatchTargetInput } from "./run-match-analysis";
import { estimateCostUsd } from "@/lib/ai/cost";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { env } from "@/lib/config/env";
import { experienceLevelLabel } from "@/lib/job/experience-levels";
import type { CvStructuredData } from "@/types/cv";
import type { JobDescriptionExtractedData } from "@/types/job";

export type ProcessMatchResult =
  | { ok: true; analysisId: string; reused: boolean }
  | { ok: false; error: string };

// Cost control (Section 14/19): a double-click or a refresh-and-resubmit
// shouldn't buy the same expensive analysis twice. Re-running after a real
// change (an edited CV, a new posting) still works — it just can't happen
// twice inside this window.
const RERUN_COOLDOWN_MS = 30_000;

interface TargetRow {
  id: string;
  cv_version_id: string;
  target_job_title: string;
  profession_custom: string | null;
  experience_level: string | null;
  career_direction: string | null;
  professions: { name: string } | null;
  countries: { name: string } | null;
  cv_versions: { uploaded_cv_id: string } | null;
}

/**
 * Runs Stages 3-4 (Section 6) for one job target using the caller's
 * RLS-scoped client — every read below is filtered to rows the signed-in
 * user owns, so a forged jobTargetId for someone else's target simply
 * finds nothing. ai_usage is written with the service-role client, same as
 * every other AI stage (see src/lib/cv/process-extraction.ts).
 */
export async function processMatchAnalysis(
  supabase: SupabaseClient<Database>,
  jobTargetId: string
): Promise<ProcessMatchResult> {
  try {
    const { data: targetData } = await supabase
      .from("job_targets")
      .select(
        "id, cv_version_id, target_job_title, profession_custom, experience_level, career_direction, professions(name), countries(name), cv_versions(uploaded_cv_id)"
      )
      .eq("id", jobTargetId)
      .single();
    if (!targetData) return { ok: false, error: "That job target could not be found." };
    const target = targetData as unknown as TargetRow;

    const { data: recent } = await supabase
      .from("cv_analyses")
      .select("id, created_at")
      .eq("job_target_id", jobTargetId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent) {
      const age = Date.now() - new Date((recent as { created_at: string }).created_at).getTime();
      if (age < RERUN_COOLDOWN_MS) {
        return { ok: true, analysisId: (recent as { id: string }).id, reused: true };
      }
    }

    const uploadedCvId = target.cv_versions?.uploaded_cv_id;
    if (!uploadedCvId) return { ok: false, error: "This target isn't linked to a CV." };

    const { data: cvData } = await supabase
      .from("cv_extracted_data")
      .select("structured_data")
      .eq("uploaded_cv_id", uploadedCvId)
      .maybeSingle();
    if (!cvData) {
      return { ok: false, error: "This CV hasn't been extracted yet, so there's nothing to analyze." };
    }
    const cv = (cvData as { structured_data: CvStructuredData }).structured_data;

    const { data: jdData } = await supabase
      .from("job_descriptions")
      .select("extracted_data")
      .eq("job_target_id", jobTargetId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const jobDescription =
      (jdData as { extracted_data: JobDescriptionExtractedData | null } | null)?.extracted_data ?? null;

    const input: MatchTargetInput = {
      targetJobTitle: target.target_job_title,
      profession: target.professions?.name ?? target.profession_custom,
      country: target.countries?.name ?? null,
      experienceLevel: experienceLevelLabel(target.experience_level),
      careerDirection: target.career_direction,
      jobDescription,
    };

    const result = await runMatchAnalysis(cv, input);
    const a = result.analysis;

    const { data: inserted, error: insertError } = await supabase
      .from("cv_analyses")
      .insert({
        cv_version_id: target.cv_version_id,
        job_target_id: jobTargetId,
        match_score: a.overallMatchScore,
        strong_matches: a.strongMatches,
        partial_matches: a.partialMatches,
        gaps: a.gaps,
        certification_gaps: a.certificationGaps,
        education_gaps: a.educationGaps,
        experience_gaps: a.experienceGaps,
        keyword_analysis: { found: a.atsKeywordsFound, missing: a.atsKeywordsMissing },
        recommendations: a.recommendations,
        scoring_notes: a.scoringNotes ?? null,
        basis: result.basis,
        analysis_model: result.model,
        prompt_version: result.promptVersion,
      })
      .select("id")
      .single();
    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? "Could not store the analysis.");
    }

    // Cost is logged after the analysis is safely stored. A failure to log
    // must never cost the user the result they've already waited for.
    try {
      const serviceClient = createServiceRoleClient();
      await serviceClient.from("ai_usage").insert({
        optimization_job_id: null, // the free preview happens before any optimization_job exists
        stage: "matching", // one call covers Section 6 Stages 3 (matching) and 4 (gap analysis)
        provider: env.ai.provider(),
        model: result.model,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        estimated_cost_usd: estimateCostUsd(result.model, result.inputTokens, result.outputTokens),
      });
    } catch (logError) {
      console.error("ai_usage logging failed for match analysis", logError);
    }

    return { ok: true, analysisId: (inserted as { id: string }).id, reused: false };
  } catch (err) {
    // The real cause (provider error body, missing env var name) stays in
    // server logs; the user gets a message that's safe to show.
    console.error("Match analysis failed", err);
    return { ok: false, error: "We couldn't complete the analysis. Please try again in a moment." };
  }
}
