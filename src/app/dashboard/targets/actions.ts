"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { processJobDescription } from "@/lib/job/process-jd";
import { processMatchAnalysis } from "@/lib/analysis/process-match-analysis";

export async function createJobTarget(uploadedCvId: string, formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const targetJobTitle = String(formData.get("targetJobTitle") ?? "").trim();
  const professionInput = String(formData.get("profession") ?? "").trim();
  const countryId = String(formData.get("country") ?? "").trim(); // "" = Other / International
  const experienceLevel = String(formData.get("experienceLevel") ?? "").trim();
  const careerDirection = String(formData.get("careerDirection") ?? "").trim();
  const jobDescriptionText = String(formData.get("jobDescription") ?? "").trim();

  const newTargetUrl = `/dashboard/cvs/${uploadedCvId}/targets/new`;

  if (!targetJobTitle) {
    redirect(`${newTargetUrl}?error=` + encodeURIComponent("Enter a target job title."));
  }

  // Confirm this CV belongs to the signed-in user (RLS already guarantees
  // this can't return someone else's row) and is ready to be targeted.
  const { data: cvRow } = await supabase
    .from("uploaded_cvs")
    .select("id, status")
    .eq("id", uploadedCvId)
    .single();
  if (!cvRow || (cvRow as { status: string }).status !== "extracted") {
    redirect("/dashboard");
  }

  // The suggestion list is exactly that — a suggestion. An exact (case
  // insensitive) match links profession_id; anything else is free text in
  // profession_custom, and is just as valid a target (Section 3/22).
  let professionId: string | null = null;
  let professionCustom: string | null = null;
  if (professionInput) {
    const { data: matched } = await supabase
      .from("professions")
      .select("id")
      .ilike("name", professionInput)
      .maybeSingle();
    if (matched) {
      professionId = (matched as { id: string }).id;
    } else {
      professionCustom = professionInput;
    }
  }

  const { count: existingVersionCount } = await supabase
    .from("cv_versions")
    .select("id", { count: "exact", head: true })
    .eq("uploaded_cv_id", uploadedCvId);

  const cvVersionId = randomUUID();
  const { error: versionError } = await supabase.from("cv_versions").insert({
    id: cvVersionId,
    uploaded_cv_id: uploadedCvId,
    user_id: user.id,
    label: targetJobTitle,
    version_number: (existingVersionCount ?? 0) + 1,
  });
  if (versionError) {
    redirect(`${newTargetUrl}?error=` + encodeURIComponent(versionError.message));
  }

  const jobTargetId = randomUUID();
  const { error: targetError } = await supabase.from("job_targets").insert({
    id: jobTargetId,
    cv_version_id: cvVersionId,
    target_job_title: targetJobTitle,
    profession_id: professionId,
    profession_custom: professionCustom,
    country_id: countryId || null,
    experience_level: experienceLevel || null,
    career_direction: careerDirection || null,
  });
  if (targetError) {
    redirect(`${newTargetUrl}?error=` + encodeURIComponent(targetError.message));
  }

  if (jobDescriptionText) {
    const jobDescriptionId = randomUUID();
    const { error: jdError } = await supabase.from("job_descriptions").insert({
      id: jobDescriptionId,
      job_target_id: jobTargetId,
      source: "pasted",
      raw_text: jobDescriptionText,
    });
    // Job-description analysis runs synchronously, same trade-off as CV
    // extraction in Phase 2 (see ARCHITECTURE.md § Phase 2 implementation
    // notes) — and its failure doesn't block the target from being created;
    // the detail page offers a retry.
    if (!jdError) {
      await processJobDescription(supabase, jobDescriptionId, jobDescriptionText);
    }
  }

  const serviceClient = createServiceRoleClient();
  await serviceClient.from("usage_logs").insert({
    user_id: user.id,
    event_type: "job_target_created",
    metadata: { job_target_id: jobTargetId, uploaded_cv_id: uploadedCvId },
  });

  redirect(`/dashboard/targets/${jobTargetId}`);
}

export async function retryJdExtraction(jobTargetId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: jdRow } = await supabase
    .from("job_descriptions")
    .select("id, raw_text")
    .eq("job_target_id", jobTargetId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (jdRow) {
    const { id, raw_text } = jdRow as { id: string; raw_text: string };
    await processJobDescription(supabase, id, raw_text);
  }

  redirect(`/dashboard/targets/${jobTargetId}`);
}

export async function runMatchAnalysis(jobTargetId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await processMatchAnalysis(supabase, jobTargetId);
  if (!result.ok) {
    redirect(`/dashboard/targets/${jobTargetId}?error=` + encodeURIComponent(result.error));
  }

  // A reused result (double-click inside the cooldown window) didn't run
  // anything new, so it isn't logged as a fresh analysis.
  if (!result.reused) {
    const serviceClient = createServiceRoleClient();
    await serviceClient.from("usage_logs").insert({
      user_id: user.id,
      event_type: "match_analysis_run",
      metadata: { job_target_id: jobTargetId, analysis_id: result.analysisId },
    });
  }

  revalidatePath(`/dashboard/targets/${jobTargetId}`);
  redirect(`/dashboard/targets/${jobTargetId}`);
}
