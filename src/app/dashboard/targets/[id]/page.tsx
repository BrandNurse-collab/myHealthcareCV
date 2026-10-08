import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { retryJdExtraction, runMatchAnalysis } from "../actions";
import { JdExtractedView } from "@/components/job/jd-extracted-view";
import { MatchAnalysisView } from "@/components/analysis/match-analysis-view";
import { SubmitButton } from "@/components/submit-button";
import { experienceLevelLabel } from "@/lib/job/experience-levels";
import { ANALYSIS_COLUMNS, analysisFromRow, type AnalysisRow } from "@/lib/analysis/analysis-row";
import type { JobDescriptionExtractedData } from "@/types/job";

// The match analysis calls the stronger model and can run longer than a
// platform's default function timeout — raise it for this route (check the
// ceiling your hosting plan allows).
export const maxDuration = 60;

interface JobTargetRow {
  id: string;
  target_job_title: string;
  profession_custom: string | null;
  experience_level: string | null;
  career_direction: string | null;
  professions: { name: string } | null;
  countries: { name: string } | null;
  cv_versions: {
    label: string | null;
    uploaded_cvs: { original_filename: string; id: string } | null;
  } | null;
}

interface JobDescriptionRow {
  id: string;
  raw_text: string;
  extracted_data: JobDescriptionExtractedData | null;
  created_at: string;
}

export default async function JobTargetDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const supabase = await createServerSupabaseClient();

  const { data: targetRow } = await supabase
    .from("job_targets")
    .select(
      "id, target_job_title, profession_custom, experience_level, career_direction, professions(name), countries(name), cv_versions(label, uploaded_cvs(original_filename, id))"
    )
    .eq("id", params.id)
    .single();
  if (!targetRow) notFound();
  const target = targetRow as unknown as JobTargetRow;

  const { data: jdRow } = await supabase
    .from("job_descriptions")
    .select("id, raw_text, extracted_data, created_at")
    .eq("job_target_id", target.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const jd = jdRow as JobDescriptionRow | null;

  const { data: analysisRow } = await supabase
    .from("cv_analyses")
    .select(ANALYSIS_COLUMNS)
    .eq("job_target_id", target.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const stored = analysisRow ? analysisFromRow(analysisRow as unknown as AnalysisRow) : null;

  const sourceCv = target.cv_versions?.uploaded_cvs;

  // Has anything the analysis was built from changed since it ran? If so,
  // say so — a stale score presented as current is worse than no score.
  let isStale = false;
  if (stored) {
    const analyzedAt = new Date(stored.createdAt).getTime();
    if (sourceCv) {
      const { data: cvData } = await supabase
        .from("cv_extracted_data")
        .select("updated_at")
        .eq("uploaded_cv_id", sourceCv.id)
        .maybeSingle();
      const cvUpdated = (cvData as { updated_at: string } | null)?.updated_at;
      if (cvUpdated && new Date(cvUpdated).getTime() > analyzedAt) isStale = true;
    }
    if (jd && new Date(jd.created_at).getTime() > analyzedAt) isStale = true;
    if (stored.basis === "title_only" && jd?.extracted_data) isStale = true;
  }

  const professionLabel = target.professions?.name ?? target.profession_custom;
  const countryLabel = target.countries?.name ?? "Other / International";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      {sourceCv && (
        <Link
          href={`/dashboard/cvs/${sourceCv.id}`}
          className="text-sm font-medium text-navy underline underline-offset-4"
        >
          &larr; {sourceCv.original_filename}
        </Link>
      )}
      <h1 className="mt-3 font-serif text-2xl text-ink">{target.target_job_title}</h1>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink/70">
        {professionLabel && <span>{professionLabel}</span>}
        <span>{countryLabel}</span>
        {experienceLevelLabel(target.experience_level) && (
          <span>{experienceLevelLabel(target.experience_level)}</span>
        )}
      </div>

      {target.career_direction && (
        <p className="mt-4 max-w-prose text-ink/70">{target.career_direction}</p>
      )}

      {searchParams.error && (
        <p role="alert" className="mt-6 rounded-sm border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-ink">
          {searchParams.error}
        </p>
      )}

      <div className="mt-10 border-t border-line pt-8">
        <h2 className="font-serif text-lg text-ink">Job description analysis</h2>

        {!jd && (
          <p className="mt-3 text-ink/70">
            No job description was pasted for this target, so the match analysis below will rely
            on the job title, profession, and country only. Pasting the actual posting gives a
            more precise result.
          </p>
        )}

        {jd && !jd.extracted_data && (
          <div className="mt-4 rounded-sm border border-amber/40 bg-amber/10 px-6 py-6">
            <p className="text-ink/80">We couldn&rsquo;t analyze the pasted job description.</p>
            <form action={retryJdExtraction.bind(null, target.id)} className="mt-4">
              <SubmitButton variant="navy" pendingLabel={"Retrying\u2026"}>
                Retry analysis
              </SubmitButton>
            </form>
          </div>
        )}

        {jd?.extracted_data && (
          <div className="mt-6">
            <JdExtractedView data={jd.extracted_data} />
          </div>
        )}
      </div>

      <div className="mt-10 border-t border-line pt-8">
        <h2 className="font-serif text-lg text-ink">CV match analysis</h2>

        {!stored && (
          <div className="mt-4">
            <p className="max-w-prose text-ink/70">
              Compare your reviewed CV against this role. You&rsquo;ll see an alignment score, what
              your CV already supports, what it doesn&rsquo;t show, and how to improve it — without
              anything being invented or changed.
            </p>
            {jd && !jd.extracted_data && (
              <p className="mt-3 max-w-prose text-sm text-ink/70">
                The job description couldn&rsquo;t be analyzed yet, so running now would use the job
                title only. Retry the job description analysis above first for a more precise result.
              </p>
            )}
            <form action={runMatchAnalysis.bind(null, target.id)} className="mt-5">
              <SubmitButton variant="navy" pendingLabel={"Analyzing your CV\u2026"}>
                Run match analysis
              </SubmitButton>
            </form>
          </div>
        )}

        {stored && (
          <div className="mt-6">
            {isStale && (
              <p role="status" className="mb-6 rounded-sm border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-ink">
                Your CV details or this job description changed after this analysis ran, so the
                results below may be out of date. Re-run the analysis to refresh them.
              </p>
            )}
            <MatchAnalysisView analysis={stored.analysis} basis={stored.basis} />
            <form action={runMatchAnalysis.bind(null, target.id)} className="mt-10 border-t border-line pt-6">
              <SubmitButton variant="navy" pendingLabel={"Re-analyzing\u2026"}>
                Re-run analysis
              </SubmitButton>
            </form>
          </div>
        )}
      </div>

      <p className="mt-10 rounded-sm border border-dashed border-line px-6 py-5 text-sm text-ink/70">
        Rewriting your CV for this role, payment, and download aren&rsquo;t available yet — they&rsquo;re
        the next steps after this analysis.
      </p>
    </main>
  );
}
