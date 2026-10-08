# myHealthcareCV — Architecture (Phase 1)

## 1. Final architecture

```
                         ┌────────────────────────┐
                         │        Browser          │
                         │  Next.js Client Comps    │
                         └───────────┬─────────────┘
                                     │ HTTPS
                         ┌───────────▼─────────────┐
                         │   Next.js (Vercel)       │
                         │  App Router, Server      │
                         │  Components, Server       │
                         │  Actions, API Routes,     │
                         │  Middleware (session)     │
                         └──┬─────────┬─────────┬───┘
                            │         │         │
              RLS-scoped    │         │         │ service-role
              queries       │         │         │ (bypasses RLS)
                            ▼         │         ▼
                 ┌─────────────────┐  │  ┌──────────────────┐
                 │ Supabase        │  │  │ Paystack           │
                 │  - Postgres     │  │  │  webhook + verify   │
                 │  - Auth         │  │  └──────────────────┘
                 │  - Storage      │  │
                 └─────────────────┘  │
                                     ▼
                         ┌──────────────────────────┐
                         │ AI provider abstraction    │
                         │  (Anthropic | OpenAI)       │
                         │  src/lib/ai                 │
                         └──────────────────────────┘
```

Two access paths into Postgres, deliberately kept separate:

- **User-scoped path** — every Server Component/Action uses
  `createServerSupabaseClient()`, which carries the signed-in user's session
  cookie. Every query goes through Row Level Security. This is the path for
  everything a user does: upload a CV, request an analysis, view their own
  jobs.
- **Service-role path** — `createServiceRoleClient()` bypasses RLS entirely.
  It exists for exactly three callers: the Paystack webhook (writing a
  payment row before any user request could forge one), the background
  optimization-job processor (moving a job through states on the user's
  behalf), and admin aggregate/reporting queries. It is never imported into
  anything that runs in the browser, and nothing outside those three call
  sites should import it — that boundary is worth enforcing in code review,
  not just documentation.

## 2. Database schema

Full DDL is in `supabase/schema.sql` (RLS policies included); this is the
entity map and the reasoning behind the less obvious decisions.

```
auth.users ─┬─▶ profiles ─┬─▶ uploaded_cvs ─┬─▶ cv_extracted_data
            │             │                 │
            │             │                 └─▶ cv_versions ─┬─▶ job_targets ─┬─▶ job_descriptions
            │             │                                  │                │
            │             │                                  │                └─▶ cv_analyses
            │             │                                  │
            │             └─▶ optimization_jobs ◀────────────┘
            │                        │  │
            │                        │  └─▶ generated_documents
            │                        └─────▶ payments
            │
            └─▶ admin_users

countries / professions / templates — standalone reference tables,
referenced by job_targets / optimization_jobs / generated_documents.
```

Decisions worth calling out:

- **`uploaded_cvs` vs. `cv_versions`**: the raw upload is never mutated.
  Every optimization run creates a `cv_versions` row pointing back at the
  same `uploaded_cvs` row, so one CV can be tailored for job A, B, and C
  without any of those runs touching each other (Section 16 of the brief).
- **`profession_id` + `profession_custom` on `job_targets`**: the featured
  professions list is a suggestion index, not a constraint. A user typing
  something the list never anticipated writes straight to
  `profession_custom` and the row is exactly as valid as one that matched a
  suggestion. The same free-text-first pattern applies to `target_job_title`
  (always plain text) and `country_id` (nullable — null means "Other /
  International," not "invalid").
- **`gaps` is a JSON array, not a boolean per requirement**: Section 8 draws
  a hard line between "not found in CV" and "user doesn't have this." That
  distinction has to survive into the data model, not just the prompt — so
  each gap entry carries its own status rather than collapsing to a single
  match/no-match flag.
- **`optimization_jobs.status`** is the state machine the retry logic in
  Section 28 depends on (`awaiting_payment → payment_verified → optimizing →
  qa_review → generating_document → completed`, with `failed` reachable from
  any AI or generation step). A job that fails after payment keeps its
  `payment_verified` state and its `payment_id` — the retry path re-enters
  the pipeline without re-charging, which is the whole point of Section 28's
  "the user must not lose their purchase" requirement.
- **`profiles` is created by a database trigger** (`handle_new_user()`), not
  application code. Supabase Auth can create the `auth.users` row before or
  during email confirmation, and application code doesn't get a reliable
  hook into that timing — a trigger does.
- **RLS shape**: every user-owned table's policy either checks
  `user_id = auth.uid()` directly, or walks a `exists (select ... join ...)`
  chain up to whichever ancestor table actually has `user_id`
  (`cv_extracted_data` → `uploaded_cvs`; `job_descriptions` →
  `job_targets` → `cv_versions`). `is_admin()` is `security definer` so it
  can read `admin_users` inside a policy without that policy needing its own
  recursive exception.

## 3. Folder structure

```
healthcv-ai/
├── ARCHITECTURE.md
├── README.md
├── package.json / tsconfig.json / next.config.mjs / tailwind.config.ts
├── .env.example
├── supabase/
│   ├── schema.sql       # tables, indexes, triggers, RLS — Sections 18-19
│   ├── storage.sql      # private `cvs` bucket + owner-folder RLS policies
│   ├── migrations/
│   │   └── 002_matching_engine.sql  # upgrades an existing DB's cv_analyses (idempotent)
│   └── seed.sql         # illustrative reference data only
└── src/
    ├── middleware.ts     # session refresh + /dashboard gate
    ├── app/
    │   ├── layout.tsx / globals.css
    │   ├── page.tsx              # landing page (Section 21)
    │   ├── (auth)/
    │   │   ├── actions.ts        # signUp / signIn / signOut server actions
    │   │   ├── login/page.tsx
    │   │   └── signup/page.tsx
    │   ├── dashboard/
    │   │   ├── page.tsx          # "My CVs" + "My job applications" lists
    │   │   ├── cvs/
    │   │   │   ├── actions.ts    # uploadCv / retryExtraction / updateExtractedData
    │   │   │   ├── new/page.tsx  # upload form
    │   │   │   └── [id]/
    │   │   │       ├── page.tsx           # status-aware detail: processing / failed+retry / review
    │   │   │       └── targets/new/page.tsx  # job-targeting form for this CV
    │   │   └── targets/
    │   │       ├── actions.ts    # createJobTarget / retryJdExtraction
    │   │       └── [id]/page.tsx # target details + JD analysis, retry on failure
    │   └── api/health/route.ts
    ├── components/
    │   ├── form-field.tsx
    │   ├── submit-button.tsx     # useFormStatus-based pending state
    │   ├── cv/
    │   │   ├── entry-list-editor.tsx   # generic add/remove editor, reused across CV sections
    │   │   ├── string-list-field.tsx   # flat string[] sections (skills, languages...)
    │   │   └── cv-review-form.tsx      # composes the two above around CvStructuredData
    │   ├── job/
    │   │   └── jd-extracted-view.tsx   # renders JobDescriptionExtractedData
    │   └── analysis/
    │       └── match-analysis-view.tsx # score, matches, gaps, keywords, suggestions
    ├── lib/
    │   ├── config/env.ts         # fails fast on a missing env var, once, centrally
    │   ├── supabase/
    │   │   ├── client.ts         # browser client
    │   │   └── server.ts         # RLS-scoped + service-role clients
    │   ├── cv/
    │   │   ├── validate.ts             # size + content-sniffed type check
    │   │   ├── extract-text.ts         # pdf-parse / mammoth → raw text
    │   │   ├── extract-structured.ts   # AI call → CvStructuredData
    │   │   └── process-extraction.ts   # ties the above together + status/ai_usage writes
    │   ├── job/
    │   │   ├── extract-jd.ts           # AI call → JobDescriptionExtractedData
    │   │   ├── process-jd.ts           # ties extraction + DB write + ai_usage together
    │   │   └── experience-levels.ts    # the one fixed enum in the targeting system
    │   ├── analysis/
    │   │   ├── run-match-analysis.ts      # AI call + normalization/safeguards
    │   │   ├── process-match-analysis.ts  # load inputs, cooldown, store, log cost
    │   │   └── analysis-row.ts            # cv_analyses row <-> domain type
    │   └── ai/
    │       ├── provider.ts       # interface + factory (AI_PROVIDER switch)
    │       ├── cost.ts           # per-model $/token table → ai_usage.estimated_cost_usd
    │       ├── json.ts           # shared jsonMode response parser (every AI stage)
    │       ├── providers/
    │       │   ├── anthropic.ts
    │       │   └── openai.ts
    │       └── prompts/
    │           ├── extraction.ts    # versioned Stage-1 system prompt (Section 24)
    │           ├── job-analysis.ts  # versioned Stage-2 system prompt (Section 24)
    │           └── matching.ts      # versioned Stage 3-4 prompt: rubric, evidence rules
    └── types/
        ├── cv.ts                 # CvStructuredData — Section 5's shape, shared everywhere
        ├── job.ts                # JobDescriptionExtractedData — Section 4's shape
        ├── analysis.ts           # CvMatchAnalysis — the matching engine's output
        └── database.ts           # placeholder — regenerate via `supabase gen types`
```

Phases 4–7 extend this shape rather than restructuring it:
`lib/ai/prompts/{matching,gap-analysis,optimization,qa}.ts` for the
remaining versioned prompts in Section 24, `lib/documents/{docx,pdf}.ts`
for generation, `lib/payments/paystack.ts` plus
`app/api/webhooks/paystack/route.ts`, and `app/admin/...` alongside
`app/dashboard/...`.

## 4. User journey

```
Landing page
   │  (free, no account needed to read)
   ▼
Sign up  ──────────────────────────────────────────┐
   │                                                │ profiles row auto-created
   ▼                                                │ by DB trigger
Dashboard → "New CV"                                │
   │                                                ▼
   ▼
Upload CV (PDF/DOCX) ──▶ extraction (Phase 2) ──▶ user reviews/edits
   │                                              structured data
   ▼
Target: job title (free text) + optional pasted JD +
        profession (suggest or custom) + country + experience level
   │
   ▼
AI analysis (free preview): match %, strong/partial matches, gaps
   │
   ▼
"Optimize & Download — ₦5,000" ──▶ Paystack checkout
   │                                     │
   │                          webhook verifies server-side
   ▼                                     ▼
optimization_jobs.status: payment_verified ──▶ optimizing ──▶ qa_review
   │                                                              │
   ▼                                                              ▼
generating_document ◀─────────────────────────────────────────────
   │
   ▼
completed → user downloads PDF/DOCX, can start another job_target
             against the same uploaded_cvs row for a different opportunity
```

A failure at any AI or generation step lands the job in `failed` with its
`payment_id` intact and a `failure_reason` recorded — the dashboard's retry
action re-runs from the failed stage, not from checkout.

## 5. AI architecture

`src/lib/ai/provider.ts` defines one interface —
`complete({ system, prompt, model?, maxTokens?, jsonMode? })` — and a factory
that reads `AI_PROVIDER` and returns either `AnthropicProvider` or
`OpenAIProvider`. Both call their provider's REST API directly with `fetch`
rather than pulling in an SDK: Section 26 asks to avoid unnecessary
dependencies, and a raw `fetch` to one JSON endpoint doesn't earn a
dependency the way multi-file SDKs with their own retry/streaming/telemetry
layers would. Every pipeline stage in Phases 2–4 (extraction, job analysis,
matching, gap analysis, optimization, QA) is written against
`AIProvider`/`getAIProvider()` only — never against `fetch` or a provider SDK
directly — so a provider or model swap is an env var, not a merge conflict
across six files.

Cost control, concretely:

- `AI_MODEL` and `AI_MODEL_FAST` are separate on purpose. Structured
  extraction (turning CV text into JSON) and job-description parsing are
  comparatively easy, well-specified tasks — route those to the fast/cheap
  model. Optimization and the QA/fabrication check are where quality
  actually matters to the user and to the business (a fabricated
  certification is a real liability) — keep those on the stronger model.
- `ai_usage` logs `input_tokens`/`output_tokens` per stage per job.
  `src/lib/ai/cost.ts` turns that into `estimated_cost_usd` using a
  `$/1M tokens` table — a placeholder right now, and deliberately isolated
  in one file so updating provider pricing is a one-file edit, not a
  search-and-replace.
- Every prompt (once written in Phase 2+) gets a version string, and
  `optimization_jobs.prompt_version` records which version produced a given
  run — the "which prompt generated this CV" traceability Section 24 asks
  for, without needing a separate prompt-history table yet.
- Fabrication control is a QA *stage*, not a QA *instruction folded into the
  optimization prompt*. Section 6 specifies a second pass whose only job is
  checking the first pass's output against the extracted source CV — that
  separation matters: a single prompt asked to both improve wording and
  self-police against embellishment reliably drifts toward the instruction
  it's already optimizing for (making the CV sound better) at the expense of
  the one it isn't (restraint).

## 6. Payment architecture

₦5,000 (`CV_OPTIMIZATION_PRICE_KOBO`, stored in kobo to avoid float math) per
optimization, via Paystack.

```
Client initializes Paystack checkout (public key, amount, reference)
   │
   ▼
Paystack redirects back with a reference
   │
   ▼
Server Action / route handler calls Paystack's verify-transaction endpoint
using PAYSTACK_SECRET_KEY (server-only — never sent to the browser)
   │
   ▼
On "success": service-role client writes a `payments` row
(status='success', verified_at=now(), raw_webhook_payload stored)
and flips the linked `optimization_jobs.status` to 'payment_verified'
   │
   ▼
Background processor picks up 'payment_verified' jobs and runs the pipeline
```

Non-negotiables carried over from Section 13:

- **Client-side confirmation is never trusted.** The flow above only writes
  a `payments` row after the server calls Paystack's own verify endpoint —
  a client claiming success is not sufficient, because it's trivially
  forgeable.
- **The Paystack webhook is the authoritative second path to the same
  effect**, for the case where the user closes the tab before the
  client-side redirect fires. Both the webhook and the post-redirect verify
  call are idempotent on `paystack_reference` (`unique not null` on that
  column) — whichever arrives first wins, the second is a no-op.
- **No download without a `payments` row with `status = 'success'`** tied to
  that `optimization_jobs.id`. This is enforced at the RLS/query layer, not
  just in the UI — a user directly hitting a document's storage path
  without a verified payment gets nothing, because `generated_documents`
  RLS resolves through `optimization_jobs`, and the document itself isn't
  generated until the job reaches `generating_document`, which only happens
  after `payment_verified`.
- **A failed AI run after payment doesn't strand the user's money** — see
  the `failed` state and retry path in Section 4 above.

## 7. Security architecture

- **Row Level Security is the primary access boundary, not an app-layer
  check.** Every user-owned table in `schema.sql` has RLS enabled with a
  policy tying it back to `auth.uid()`, so a bug in application code can't
  leak another user's CV — the database refuses the query regardless of
  what the API route intended.
- **Two Supabase clients, two trust levels**, enforced by which file you
  import from (`src/lib/supabase/client.ts` vs. `server.ts`'s
  `createServiceRoleClient`) — see the two-access-path split in Section 1.
  `SUPABASE_SERVICE_ROLE_KEY` is read only in `src/lib/config/env.ts` on the
  server; it is never referenced in a Client Component, and `next.config.mjs`
  has no `env` block re-exposing it.
- **Secrets discipline**: `AI_API_KEY`, `PAYSTACK_SECRET_KEY`, and the
  service-role key are unprefixed (no `NEXT_PUBLIC_`), which is what keeps
  Next.js from bundling them into client JavaScript in the first place — the
  `NEXT_PUBLIC_` prefix is opt-in exposure, not opt-out, but it's worth
  stating as a rule rather than trusting everyone on the team to remember it.
- **File uploads** (Phase 2) will be validated on type (`pdf`/`docx` only,
  checked by content sniffing, not just file extension) and size before
  they ever reach Storage, and served back to the owning user only via
  short-lived signed URLs — never a public bucket.
- **`admin_users` is a separate table from `profiles.role`**, checked by a
  `security definer` function (`is_admin()`) rather than trusting a
  client-editable `role` column on its own. `profiles.role` exists for
  quick display logic; RLS policies key off `admin_users` membership, so
  granting admin access is an explicit, auditable insert rather than a
  value a compromised update could flip.
- **Rate limiting and stricter input validation** (Section 19) land with the
  endpoints that need them most — CV upload and the AI-triggering routes —
  in Phase 2 rather than Phase 1, since there's no attack surface for either
  until those routes exist.

## Phase 2 implementation notes

- **Content-sniffing, not trust**: `validate.ts` checks the first four bytes
  of the upload (`%PDF` / the zip header a `.docx` is built on) rather than
  trusting the filename extension or the browser's declared MIME type —
  either of those is trivial for a client to misreport.
- **Synchronous extraction, deliberately, for now**: `uploadCv` runs text
  extraction and the AI structuring call in the same request instead of
  handing off to a queue. There's no job-queue infrastructure yet (Phase 2's
  brief doesn't ask for one), and CV extraction is short enough to fit
  comfortably inside a normal serverless function timeout. This is the
  first place worth revisiting if CV sizes or AI latency grow — the
  `uploaded_cvs.status` state machine (`uploaded → extracting → extracted /
  failed`) already models the states a background worker would need, so
  moving to one later is a scheduling change, not a schema change.
- **`pdf-parse` is imported from its internal `lib/pdf-parse.js` entry
  point, not the package root.** The package root has a debug snippet that
  can try to read a fixture file off disk under some bundlers; the internal
  entry point skips it. Worth remembering if `pdf-parse` is ever upgraded
  and this stops being necessary.
- **The review screen is one generic array editor, not eleven bespoke
  ones.** `EntryListEditor<T>` takes a small field-config array and covers
  employment history, education, certifications, publications, projects,
  awards, training, and volunteer experience — all of it structurally
  "a list of objects with a few labeled fields," which is most of what
  Section 5's structured representation actually contains. Flat string
  arrays (skills, languages, registrations, research) get the simpler
  `StringListField`. This is why adding a twelfth section later is a
  four-line field-config addition, not a new component.
- **Extraction cost isn't tied to a job.** `ai_usage.optimization_job_id` is
  nullable specifically because extraction happens once, at upload time,
  before the user has chosen a target job or paid for anything — the
  Section 29 cost picture for a CV therefore sums every `ai_usage` row
  whose downstream `optimization_jobs` trace back to the same
  `uploaded_cvs` row, not just the ones with a job already attached.
- **A failed extraction is shown, not hidden.** A scanned/image-only PDF (no
  extractable text layer) fails loudly with a specific message and a retry
  action, rather than silently handing a near-empty CV to the next stage —
  consistent with Section 6's requirement that fabrication risk gets caught
  as early in the pipeline as possible.

## Phase 3 implementation notes

- **Country is a closed list; profession and job title are not — on
  purpose, and differently from each other.** Section 3 specifies
  "searchable country selection plus Other/International," which is a
  bounded, known set — so country is a real `<select>` sourced from
  `countries`, with `country_id = null` meaning Other/International.
  Profession is genuinely open-ended, so it's a free-text `<input>` backed
  by a `<datalist>` of suggestions: typing something that matches a
  `professions.name` (case-insensitive) links `profession_id`; anything
  else — a role the suggestion list never anticipated — is just as valid,
  stored in `profession_custom`. `target_job_title` has no suggestion list
  at all; it's always plain text, matching Section 22's "the core input
  must be 'what are you applying for'" instruction directly.
- **The job-description prompt doesn't carry the same fabrication
  constraint as CV extraction, and shouldn't.** `EXTRACTION_SYSTEM_PROMPT`
  is protecting a candidate from having qualifications invented on their
  behalf; `JOB_ANALYSIS_SYSTEM_PROMPT` is organizing an employer's own
  stated requirements, so its job is faithfulness to the posting (don't
  drop a stated requirement, don't add one it never mentioned) rather than
  the CV side's stricter "never write anything not verbatim-traceable."
  Both still return `jsonMode` JSON at `temperature: 0` and share
  `src/lib/ai/json.ts` for parsing — the two prompts differ in what they're
  being careful *about*, not in how they're called.
- **`keywords` absorbs what the brief lists as two fields ("Keywords" and
  "ATS terms").** In practice a model asked for both tends to produce two
  overlapping lists of the same terms; one field asked to capture "what's
  worth a CV echoing, for a human reader and an ATS scan alike" gets a
  cleaner result than forcing an artificial split.
- **One job target, one `cv_versions` row, and the original CV never
  changes.** Creating a target doesn't touch `cv_extracted_data` (which is
  keyed to `uploaded_cvs`, not `cv_versions`) — it only adds a new
  `cv_versions` row and a `job_targets` row pointing at it. A CV reviewed
  once can be targeted at any number of jobs without re-review, which is
  exactly Section 16's "one CV, optimized separately for Job A, B, and C."
- **A job description's own history isn't overwritten.** `job_descriptions`
  has no unique constraint on `job_target_id` by design — pasting a
  replacement posting later inserts a new row rather than destroying the
  old one, and every read takes the most recent row for that target. A
  retry after a failed analysis reuses the existing row's `raw_text`
  instead of asking the user to paste it again.

## Matching engine implementation notes

- **One call for what the brief calls two stages.** Section 6 lists matching
  and gap analysis separately; they run as a single prompt
  (`matching-v1`). A model reasoning about what matches and what's missing
  in one pass is more internally consistent than reconciling two calls, and
  it halves cost and latency. `ai_usage.stage` is `matching` for the
  combined call.
- **The stronger model, on purpose.** Extraction and job-description parsing
  use `AI_MODEL_FAST`; this call uses `AI_MODEL`, because it is the output a
  user judges the product by and, eventually, pays against.
- **The score is model-judged against a written rubric, not computed by a
  formula — say so plainly.** The prompt fixes the weighting (mandatory over
  preferred; a missing required license is a heavy penalty; experience gaps
  scale with the shortfall; education weighs in proportion to how firmly the
  posting requires it). "Explainable" here means the score comes with
  `scoringNotes`, every match carries the CV evidence behind it, and every
  gap is tagged required or preferred. It does *not* mean two runs will
  produce identical numbers or that the number can be recomputed by hand.
  If users start disputing scores, the upgrade path is to have the model
  emit a weight and a matched/partial/missing status per requirement and
  compute the score in code — deterministic, auditable, reproducible. That
  is a larger change to the prompt and schema and was deliberately not done
  in this pass.
- **Safeguards in code, not just in the prompt.** `normalizeAnalysis` is the
  last line of defence before anything is stored or shown: a "strong" match
  with no cited evidence is demoted to partial (an unsupported claim is
  exactly what this product exists to prevent); a missing or non-numeric
  score throws instead of being stored as 0; scores are clamped to 0–100;
  the dedicated certification/education/experience buckets force their own
  category regardless of what the model labelled them; junk entries and
  wrong types collapse to empty lists.
- **`gaps` means "everything else."** The brief lists `gaps` alongside
  separate certification, education and experience gaps. Rather than store
  the same item twice, `gaps` holds skills and other requirements, and the
  three dedicated lists hold their own categories.
- **Data minimization.** The candidate's name and contact details are
  stripped before the CV is sent to the AI provider — matching never needs
  them. Model output is rendered as escaped text, never as HTML.
- **Failure behaviour.** Provider errors, missing configuration and database
  errors are logged server-side and surfaced to the user as one safe
  message, so an API key name or provider response body never reaches the
  browser. A failure to log `ai_usage` never costs the user an analysis
  that already succeeded.
- **Cost control.** A 30-second cooldown makes a double-click or refresh
  return the existing analysis instead of buying a second one. Every run
  logs tokens and estimated cost against `stage = 'matching'`; like the
  other pre-payment stages it has no `optimization_job_id`.
- **History and staleness.** Each run inserts a new `cv_analyses` row; the
  page reads the latest via `(job_target_id, created_at desc)`. If the
  reviewed CV or the job description changed after the analysis ran — or the
  analysis was title-only and a posting has since been analyzed — the page
  says the result may be out of date instead of presenting it as current.
- **`basis`** records whether the run used an analyzed job description or the
  job title and profession alone, and the UI says which. That is Section 23's
  hierarchy made visible: the posting is the strongest signal, and without
  one the analysis is labelled lower-confidence rather than presented with
  false precision.
- **Schema.** `keyword_analysis` (already present) now holds
  `{ found, missing }`; `certification_gaps`, `education_gaps`,
  `experience_gaps`, `recommendations`, `scoring_notes`, `basis` and
  `prompt_version` were added. RLS is row-level and already covered
  `cv_analyses`, so no policy changed.
- **What is and isn't tested.** `npm test` covers parsing, normalization,
  the safeguards above, the persistence pipeline (fake database) and the
  rendered UI. No live model call was made — no API key was available while
  building — so the prompt's *judgment* is unverified. Run a set of real CV
  and job-description pairs and compare against your own read before
  putting a score in front of paying users.
