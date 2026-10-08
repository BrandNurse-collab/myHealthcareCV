import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signOut } from "./(auth)/actions";

interface UploadedCvListRow {
  id: string;
  original_filename: string;
  status: "uploaded" | "extracting" | "extracted" | "failed";
  created_at: string;
}

interface ExtractedFlagRow {
  uploaded_cv_id: string;
  reviewed_by_user: boolean;
}

interface JobTargetOverviewRow {
  id: string;
  target_job_title: string;
  created_at: string;
  cv_versions: { uploaded_cvs: { original_filename: string } | null } | null;
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userData.user?.id ?? "")
    .single();
  // Cast away the placeholder Database type's `never` inference — replace
  // once real generated types are in src/types/database.ts.
  const profile = profileRow as { full_name: string | null } | null;

  const { data: cvRows } = await supabase
    .from("uploaded_cvs")
    .select("id, original_filename, status, created_at")
    .order("created_at", { ascending: false });
  const cvs = (cvRows ?? []) as UploadedCvListRow[];

  const { data: reviewFlagRows } = await supabase
    .from("cv_extracted_data")
    .select("uploaded_cv_id, reviewed_by_user");
  const reviewedById = new Map(
    ((reviewFlagRows ?? []) as ExtractedFlagRow[]).map((r) => [r.uploaded_cv_id, r.reviewed_by_user])
  );

  const { data: targetRows } = await supabase
    .from("job_targets")
    .select("id, target_job_title, created_at, cv_versions(uploaded_cvs(original_filename))")
    .order("created_at", { ascending: false });
  const targets = (targetRows ?? []) as unknown as JobTargetOverviewRow[];

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-ink">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="mt-1 text-ink/60">{userData.user?.email}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="text-sm font-medium text-navy underline underline-offset-4">
            Sign out
          </button>
        </form>
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="font-serif text-lg text-ink">My CVs</h2>
        <Link
          href="/dashboard/cvs/new"
          className="rounded-sm bg-amber px-4 py-2 text-sm font-medium text-paper hover:bg-amber-dark"
        >
          Upload a CV
        </Link>
      </div>

      {cvs.length === 0 ? (
        <section className="mt-6 rounded-sm border border-dashed border-line px-8 py-12 text-center">
          <h3 className="font-serif text-lg text-ink">No CVs yet</h3>
          <p className="mx-auto mt-2 max-w-sm text-ink/60">
            Upload one to get started — you can tailor it for as many
            different roles as you need.
          </p>
        </section>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {cvs.map((cv) => (
            <li key={cv.id} className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium text-ink">{cv.original_filename}</p>
                <p className="mt-0.5 text-sm text-ink/50">{statusLabel(cv, reviewedById.get(cv.id))}</p>
              </div>
              <Link
                href={`/dashboard/cvs/${cv.id}`}
                className="text-sm font-medium text-navy underline underline-offset-4"
              >
                {actionLabel(cv, reviewedById.get(cv.id))}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {targets.length > 0 && (
        <>
          <h2 className="mt-12 font-serif text-lg text-ink">My job applications</h2>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {targets.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium text-ink">{t.target_job_title}</p>
                  {t.cv_versions?.uploaded_cvs?.original_filename && (
                    <p className="mt-0.5 text-sm text-ink/50">
                      {t.cv_versions.uploaded_cvs.original_filename}
                    </p>
                  )}
                </div>
                <Link
                  href={`/dashboard/targets/${t.id}`}
                  className="text-sm font-medium text-navy underline underline-offset-4"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function statusLabel(cv: UploadedCvListRow, reviewed: boolean | undefined): string {
  switch (cv.status) {
    case "uploaded":
    case "extracting":
      return "Processing\u2026";
    case "failed":
      return "Extraction failed";
    case "extracted":
      return reviewed ? "Reviewed" : "Extracted \u2014 needs review";
  }
}

function actionLabel(cv: UploadedCvListRow, reviewed: boolean | undefined): string {
  if (cv.status === "failed") return "View & retry";
  if (cv.status === "extracted") return reviewed ? "Edit details" : "Review details";
  return "View";
}
