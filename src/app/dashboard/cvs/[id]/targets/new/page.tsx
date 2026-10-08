import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createJobTarget } from "@/app/dashboard/targets/actions";
import { SubmitButton } from "@/components/submit-button";
import { EXPERIENCE_LEVELS } from "@/lib/job/experience-levels";

// This page hosts a Server Action that calls an AI model — raise the timeout
// above a platform's short default (check the ceiling your hosting plan allows).
export const maxDuration = 60;

interface ProfessionOption {
  id: string;
  name: string;
}
interface CountryOption {
  id: string;
  name: string;
}

export default async function NewJobTargetPage({
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
  const cv = cvRow as { id: string; original_filename: string; status: string };
  if (cv.status !== "extracted") {
    redirect(`/dashboard/cvs/${cv.id}`);
  }

  const [{ data: professionRows }, { data: countryRows }] = await Promise.all([
    supabase
      .from("professions")
      .select("id, name")
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .order("name", { ascending: true }),
    supabase.from("countries").select("id, name").eq("is_active", true).order("name", { ascending: true }),
  ]);
  const professions = (professionRows ?? []) as ProfessionOption[];
  const countries = (countryRows ?? []) as CountryOption[];

  const createJobTargetForThisCv = createJobTarget.bind(null, cv.id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm text-ink/50">{cv.original_filename}</p>
      <h1 className="mt-1 font-serif text-2xl text-ink">What are you applying for?</h1>
      <p className="mt-2 text-ink/60">
        Job title and profession are always free text — type anything, whether or not
        it matches a suggestion.
      </p>

      {searchParams.error && (
        <p className="mt-4 rounded-sm border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber-dark">
          {searchParams.error}
        </p>
      )}

      <form action={createJobTargetForThisCv} className="mt-8 space-y-6">
        <label className="block">
          <span className="text-sm font-medium text-ink/80">Target job title</span>
          <input
            name="targetJobTitle"
            required
            placeholder="e.g. Senior Clinical Research Coordinator"
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 focus:border-navy focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink/80">Profession / background</span>
          <input
            name="profession"
            list="profession-suggestions"
            placeholder="Search suggestions or type your own"
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 focus:border-navy focus:outline-none"
          />
          <datalist id="profession-suggestions">
            {professions.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
        </label>

        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-ink/80">Target country</span>
            <select
              name="country"
              defaultValue=""
              className="mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 focus:border-navy focus:outline-none"
            >
              <option value="">Other / International</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink/80">Experience level</span>
            <select
              name="experienceLevel"
              defaultValue=""
              className="mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 focus:border-navy focus:outline-none"
            >
              <option value="">Not specified</option>
              {EXPERIENCE_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-ink/80">Career direction (optional)</span>
          <textarea
            name="careerDirection"
            rows={2}
            placeholder="e.g. I'm a registered nurse transitioning into healthcare data analytics."
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 focus:border-navy focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink/80">Job description (optional, but the strongest signal)</span>
          <span className="block text-xs text-ink/50">
            Paste the full vacancy if you have it — it takes priority over every
            assumption based on job title or profession alone.
          </span>
          <textarea
            name="jobDescription"
            rows={10}
            placeholder={"Paste the job posting here\u2026"}
            className="mt-1 w-full rounded-sm border border-line px-3 py-2 font-mono text-sm focus:border-navy focus:outline-none"
          />
        </label>

        <SubmitButton pendingLabel={"Saving\u2026"}>Save target</SubmitButton>
      </form>
    </main>
  );
}
