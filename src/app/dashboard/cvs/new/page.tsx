import { uploadCv } from "../actions";
import { SubmitButton } from "@/components/submit-button";

// This page hosts a Server Action that calls an AI model — raise the timeout
// above a platform's short default (check the ceiling your hosting plan allows).
export const maxDuration = 60;

export default function NewCvPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="font-serif text-2xl text-ink">Upload your CV</h1>
      <p className="mt-2 text-ink/60">
        PDF or Word (.docx), up to 10 MB. We&rsquo;ll extract your history so you can
        review it before anything is rewritten.
      </p>

      {searchParams.error && (
        <p className="mt-4 rounded-sm border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber-dark">
          {searchParams.error}
        </p>
      )}

      <form action={uploadCv} className="mt-8 space-y-6">
        <label className="block">
          <span className="text-sm font-medium text-ink/80">CV file</span>
          <input
            type="file"
            name="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            required
            className="mt-2 block w-full rounded-sm border border-dashed border-line px-3 py-8 text-sm text-ink/70 file:mr-4 file:rounded-sm file:border-0 file:bg-navy file:px-4 file:py-2 file:text-sm file:font-medium file:text-paper hover:file:bg-navy-dark"
          />
        </label>
        <SubmitButton pendingLabel={"Uploading & analyzing\u2026"}>Upload &amp; analyze</SubmitButton>
      </form>
    </main>
  );
}
