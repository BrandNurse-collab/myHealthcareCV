# myHealthcareCV

"Tailor Your Healthcare CV to the Opportunity." — operated by Find Nurses NG.

This repo covers **Phase 1** (architecture, database, authentication),
**Phase 2** (CV upload, extraction, and review), **Phase 3** (job
targeting and job-description analysis), and the **CV matching engine**
(the matching/gap-analysis stage of the original plan). See `ARCHITECTURE.md` for the full
design. Everything below is real, type-checked, linted, and build-tested —
not a mockup.

## What's working right now

- Landing page (`/`) with the copy and sections from the product brief
- Sign up / sign in / sign out against Supabase Auth (`/signup`, `/login`)
- A `profiles` row is created automatically for every new user (DB trigger —
  no application code has to remember to do this)
- `/dashboard` is a protected route: middleware redirects signed-out users to
  `/login` and signed-in users away from `/login` and `/signup`
- The full Phase 1–9 database schema, with Row Level Security so a user can
  only ever read or write their own data (`supabase/schema.sql`), plus a
  private Storage bucket with matching owner-folder policies
  (`supabase/storage.sql`)
- An AI provider abstraction (`src/lib/ai`) that talks to Anthropic or OpenAI
  through one interface — switching providers or models is an environment
  variable change, not a code change
- **CV upload** (`/dashboard/cvs/new`): PDF/DOCX, content-sniffed (not just
  trusted by extension), size-capped, stored in a private per-user Storage
  folder
- **Extraction** (Section 6, Stage 1): PDF text via `pdf-parse`, DOCX text
  via `mammoth`, then a versioned AI prompt turns that into the structured
  shape in `src/types/cv.ts` — instructed to extract only what's written,
  never to invent or embellish. Verified end to end against real generated
  PDF/DOCX fixtures during development, not just compiled.
- **Review screen** (`/dashboard/cvs/[id]`): every extracted field is
  editable before anything downstream uses it
- A failed extraction (e.g. a scanned/image-only PDF) is surfaced clearly
  with a retry action, rather than silently producing an empty CV
- **Job targeting** (`/dashboard/cvs/[id]/targets/new`, Section 3): job
  title and profession are always free text (profession has a searchable
  suggestion list via `<datalist>` — type anything, matching or not);
  country is a real list plus "Other / International"; experience level is
  the one genuinely fixed list the brief specifies
- **Job description analysis** (Section 4, Stage 2): paste a posting and a
  second versioned AI prompt extracts required/preferred qualifications,
  responsibilities, skills, certifications, education and
  regulatory/licensing requirements, and ATS keywords — shown on the job
  target's detail page (`/dashboard/targets/[id]`), with a retry action if
  analysis fails. Each uploaded CV can be targeted at any number of jobs
  without touching the original (Section 16) — every target gets its own
  `cv_versions` row.
- **CV matching engine** (`/dashboard/targets/[id]`, Section 6 Stages 3–4):
  compares the reviewed CV against a target and produces an alignment score,
  strong matches and partial matches (each with the CV evidence behind it),
  missing requirements grouped into certifications / education / experience /
  other and tagged required-vs-preferred, ATS keywords found and worth
  adding, and improvement suggestions. Works from a pasted job description
  (strongest signal) or, with lower stated confidence, from job title and
  profession alone. Nothing is ever added to the CV: a requirement the CV
  doesn't show is "Not found in your CV," never "you don't have this."
  Re-running keeps history and flags an analysis as out of date if the CV or
  posting changed after it ran.

## What's intentionally not built yet

The CV rewrite/optimization step and its separate fabrication-check pass,
document generation (PDF/Word), Paystack payment, and the admin dashboard.
The analysis is free to run today because nothing is charged for yet — the
paywall belongs in front of the rewrite and download, which don't exist.

### Known gaps from the launch audit (not yet fixed)

- `/privacy`, `/terms`, and `/pricing` are linked from the landing page but
  have no pages behind them yet (they 404).
- SEO metadata is a title and description only — no Open Graph, Twitter
  card, canonical URL, or favicon.
- Accessibility: buttons with light text on the amber background measure
  about 3.0:1 contrast (WCAG AA needs 4.5:1 for normal text); several inputs
  drop the browser focus outline without a replacement ring; some secondary
  text (`text-ink/50`) is below 4.5:1; the landing-page nav links disappear
  on narrow screens with no menu to replace them. New UI from the matching
  engine onward avoids these; the older screens still have them.
- Rate limiting on the AI-calling actions beyond the 30-second re-run
  cooldown on match analysis.

## Setup

1. **Requirements**: Node.js 18.17+, a Supabase project, an Anthropic or
   OpenAI API key, a Paystack account (for Phase 6 — not needed to run
   this locally).

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase project URL/keys (Project Settings → API) and an
   `AI_API_KEY`. `AI_PROVIDER` and `AI_MODEL` can be changed later without
   touching any code.

4. **Database**
   In the Supabase SQL editor, run `supabase/schema.sql`, then
   `supabase/storage.sql` (creates the private `cvs` bucket + its RLS
   policies), then `supabase/seed.sql` for a starting set of
   countries/professions/templates — for Phase 3 this is no longer purely
   optional, since the targeting form reads from `countries` and
   `professions` (illustrative content only; none of it restricts what a
   user can type — see Section 3/22 of the product brief).

   **Already ran an earlier `schema.sql` on a live project?** Don't re-run
   it. Run `supabase/migrations/002_matching_engine.sql` instead — it adds
   the new `cv_analyses` columns and is safe to run more than once. A brand
   new project only needs `schema.sql`, which already includes them.

5. **Run it**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000`, create an account, upload a CV, review it,
   then create a job target and paste a posting to see the analysis.

### A note on fonts in sandboxed environments

The landing page uses `next/font/google` (Fraunces + Work Sans), which Next.js
fetches and self-hosts at build time. That requires outbound access to
`fonts.googleapis.com` / `fonts.gstatic.com`. This was verified by
temporarily swapping in system fonts, confirming the rest of the app builds
and lints clean, then restoring the Google Fonts imports — it will build
normally on Vercel, or any machine with normal internet access; it just
can't reach those two hosts from the sandbox this was built in.

### A note on what wasn't tested

CV/DOCX extraction was verified against real generated files, and the
JSON-parsing helper every AI stage shares was unit-tested against fenced,
plain, and malformed model output. The AI prompts themselves (extraction and
job analysis) were not run against a live Anthropic/OpenAI call in this
environment — no API key is available here to do that safely. Run one
real upload and one real job-description paste against your own `AI_API_KEY`
before relying on either prompt's output quality.

## Tech stack

Next.js 14 (App Router) + TypeScript + Tailwind CSS · Supabase (Postgres,
Auth, Storage) · Paystack · Anthropic/OpenAI behind a provider abstraction ·
`pdf-parse` + `mammoth` for CV text extraction · Vercel-compatible
deployment. Document generation (Phase 5) should reuse the Node `docx` and
`pptxgenjs` libraries already in use elsewhere in Find Nurses NG's tooling,
rather than introducing a new library for the same job.

## Tests

```bash
npm test
```

Runs three suites with no network or API key needed (the model call is
stubbed; everything else is the real code): the matching engine's parsing,
normalization and safeguards; the persistence pipeline against a fake
database (cooldown, cost logging, error sanitization); and the results UI
rendered for every score band and empty state. What they can't tell you is
how good the prompt's judgment is against a real model — see
`ARCHITECTURE.md § Matching engine implementation notes`.

## Next step

Before the rewrite: run 10–20 real CV and job-description pairs through the
matching engine with your own `AI_API_KEY` and check the scores and gap
lists against your own judgment — this is the one thing the test suite
can't do. Then the optimization rewrite (Section 6 Stages 5–6) with its
separate fabrication-check pass, followed by document generation and
Paystack.
