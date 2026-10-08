import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CvReviewForm } from "@/components/cv/cv-review-form";
import { retryExtraction, updateExtractedData } from "../actions";
import type { CvStructuredData } from "@/types/cv";

// This page hosts a Server Action that calls an AI model — raise the timeout
// above a platform's short default (check the ceiling your hosting plan allows).
export const maxDuration = 60;

interface UploadedCvRow {
  id: string;
  original_filename: string;
  status: "uploaded" | "extracting" | "extracted" | "failed";
}

interface CvExtractedDataRow {
  structured_data: CvStructuredData;
  reviewed_by_user: boolean;
}

interface JobTargetSummaryRow {
  id: string;
  target_job_title: string;
  created_at: string;
}

export default async function CvDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const supabase = await createServerSupabaseClient();

  const { data: cvRow } = await supabase
    .from("uploaded_cvs")
    .select("id, original_filename, status")
    .eq("id", params.id)
    .single();

  if (!cvRow) notFound();
  const cv = cvRow as UploadedCvRow;

  const { data: extractedRow } = await supabase
    .from("cv_extracted_data")
    .select("structured_data, reviewed_by_user")
    .eq("uploaded_cv_id", cv.id)
    .maybeSingle();
  const extracted = extractedRow as CvExtractedDataRow | null;

  const { data: targetRows } = await supabase
    .from("job_targets")
    .select("id, target_job_title, created_at, cv_versions!inner(uploaded_cv_id)")
    .eq("cv_versions.uploaded_cv_id", cv.id)
    .order("created_at", { ascending: false });
  const targets = (targetRows ?? []) as unknown as JobTargetSummaryRow[];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm text-ink/50">{cv.original_filename}</p>
      <h1 className="mt-1 font-serif text-2xl text-ink">Review extracted details</h1>

      {searchParams.error && (
        <p className="mt-4 rounded-sm border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber-dark">
          {searchParams.error}
        </p>
      )}

      {(cv.status === "uploaded" || cv.status === "extracting") && (
        <p className="mt-8 rounded-sm border border-line bg-white px-6 py-8 text-ink/70">
          Still processing — refresh this page in a moment.
        </p>
      )}

      {cv.status === "failed" && (
        <div className="mt-8 rounded-sm border border-amber/40 bg-amber/10 px-6 py-8">
          <p className="text-ink/80">
            We couldn&rsquo;t extract this CV automatically. This usually means the file
            is a scanned/image-only document rather than text.
          </p>
          <form action={retryExtraction.bind(null, cv.id)} className="mt-4">
            <button
              type="submit"
              className="rounded-sm bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-navy-dark"
            >
              Retry extraction
            </button>
          </form>
        </div>
      )}

      {cv.status === "extracted" && extracted && (
        <>
          <div className="mt-8 flex items-center justify-between border-b border-line pb-8">
            <div>
              <h2 className="font-serif text-lg text-ink">Job targets</h2>
              <p className="mt-1 text-sm text-ink/60">
                Tailor this CV for as many roles as you need — the original stays
                untouched.
              </p>
            </div>
            <Link
              href={`/dashboard/cvs/${cv.id}/targets/new`}
              className="whitespace-nowrap rounded-sm bg-amber px-4 py-2 text-sm font-medium text-paper hover:bg-amber-dark"
            >
              New job target
            </Link>
          </div>

          {targets.length > 0 && (
            <ul className="divide-y divide-line border-b border-line">
              {targets.map((t) => (
                <li key={t.id} className="py-3">
                  <Link
                    href={`/dashboard/targets/${t.id}`}
                    className="font-medium text-navy underline underline-offset-4"
                  >
                    {t.target_job_title}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-8 text-ink/60">
            Check the details below and fix anything the extraction got wrong before
            continuing — this is what every later step builds from.
          </p>
          <div className="mt-8">
            <CvReviewForm
              uploadedCvId={cv.id}
              initialData={extracted.structured_data}
              onSave={updateExtractedData}
            />
          </div>
        </>
      )}
    </main>
  );
}
