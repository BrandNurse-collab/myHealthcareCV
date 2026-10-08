-- ============================================================================
-- myHealthcareCV — Phase 1 schema
-- Run once in the Supabase SQL editor (or `supabase db push`) on a fresh project.
-- auth.users is managed by Supabase Auth; every other table is defined here.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────────────────
-- Reference / lookup tables (admin-managed, readable by any signed-in user)
-- ────────────────────────────────────────────────────────────────────────

create table public.countries (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,        -- ISO 3166-1 alpha-2, e.g. 'NG', 'GB'
  name         text not null,
  cv_guidance  text,                        -- admin-editable notes on local conventions
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.professions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text,                        -- e.g. 'Nursing', 'Health Insurance / HMO'
  guidance     text,                        -- admin-editable optimization hints
  is_featured  boolean not null default false,  -- shown as a suggestion chip; never restricts free text
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.templates (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,       -- e.g. 'ats-focused', 'academic-cv'
  name          text not null,
  category      text not null,              -- Professional | Academic | Research | Healthcare | Executive | International | ATS-focused
  description   text,
  layout_config jsonb not null default '{}',-- typography / spacing / section-order rules
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────────────
-- Identity
-- auth.users (Supabase Auth) holds credentials; `profiles` holds app identity.
-- ────────────────────────────────────────────────────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  country_id  uuid references public.countries(id),
  role        text not null default 'user' check (role in ('user','admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.admin_users (
  id          uuid primary key references public.profiles(id) on delete cascade,
  granted_by  uuid references public.profiles(id),
  notes       text,
  created_at  timestamptz not null default now()
);

-- A profiles row is created automatically the moment Supabase Auth creates
-- the corresponding auth.users row — the app never has to remember to do
-- this itself, and it can't race against email confirmation.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ────────────────────────────────────────────────────────────────────────
-- CVs
-- ────────────────────────────────────────────────────────────────────────

create table public.uploaded_cvs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  storage_path       text not null,          -- Supabase Storage object path
  original_filename  text not null,
  file_type          text not null check (file_type in ('pdf','docx')),
  file_size_bytes    integer not null,
  status             text not null default 'uploaded'
                       check (status in ('uploaded','extracting','extracted','failed')),
  created_at         timestamptz not null default now()
);

create table public.cv_extracted_data (
  id                uuid primary key default gen_random_uuid(),
  uploaded_cv_id    uuid not null references public.uploaded_cvs(id) on delete cascade,
  structured_data   jsonb not null,          -- name, contact, employment, education... (Section 5)
  extraction_model  text,
  reviewed_by_user  boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One uploaded CV can be optimized separately for many jobs without being modified (Section 16).
create table public.cv_versions (
  id              uuid primary key default gen_random_uuid(),
  uploaded_cv_id  uuid not null references public.uploaded_cvs(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  label           text,                      -- user-facing name, e.g. "For Acme Health – Claims Analyst"
  version_number  integer not null default 1,
  created_at      timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────────────
-- Targeting (Section 3-4) — always free text; lookups are suggestions only
-- ────────────────────────────────────────────────────────────────────────

create table public.job_targets (
  id                 uuid primary key default gen_random_uuid(),
  cv_version_id      uuid not null references public.cv_versions(id) on delete cascade,
  target_job_title   text not null,
  profession_id      uuid references public.professions(id),   -- optional suggestion match
  profession_custom  text,                                     -- free-text override, always allowed
  country_id         uuid references public.countries(id),     -- null = "Other / International"
  experience_level   text check (experience_level in
                        ('entry','early_career','mid','senior','management','executive','academic_research','other')),
  career_direction   text,                    -- optional free-text narrative
  created_at         timestamptz not null default now()
);

create table public.job_descriptions (
  id                uuid primary key default gen_random_uuid(),
  job_target_id     uuid not null references public.job_targets(id) on delete cascade,
  source            text not null default 'pasted' check (source in ('pasted','url')),
  source_url        text,
  raw_text          text not null,
  extracted_data    jsonb,                   -- title, employer, required/preferred quals, keywords...
  extraction_model  text,
  created_at        timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────────────
-- AI pipeline (Section 6)
-- ────────────────────────────────────────────────────────────────────────

create table public.cv_analyses (
  id                  uuid primary key default gen_random_uuid(),
  cv_version_id       uuid not null references public.cv_versions(id) on delete cascade,
  job_target_id       uuid not null references public.job_targets(id) on delete cascade,
  match_score         integer check (match_score between 0 and 100),
  strong_matches      jsonb not null default '[]',   -- [{ requirement, evidence }]
  partial_matches     jsonb not null default '[]',   -- [{ requirement, evidence }]
  gaps                jsonb not null default '[]',   -- skill/other gaps: "not found in CV" ≠ "user lacks it" (Section 8)
  certification_gaps  jsonb not null default '[]',   -- [{ requirement, category, severity }]
  education_gaps      jsonb not null default '[]',
  experience_gaps     jsonb not null default '[]',
  keyword_analysis    jsonb not null default '{}',   -- { found: string[], missing: string[] }
  recommendations     jsonb not null default '[]',   -- string[]
  scoring_notes       text,                          -- plain-language explanation of what drove the score
  basis               text check (basis in ('job_description','title_only')),
  analysis_model      text,
  prompt_version      text,                          -- which prompt produced this row (Section 24)
  created_at          timestamptz not null default now()
);

-- payment_id is added as a plain column here and given its foreign key
-- below, once the `payments` table exists (the two tables reference each other).
create table public.optimization_jobs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  cv_version_id   uuid not null references public.cv_versions(id) on delete cascade,
  job_target_id   uuid not null references public.job_targets(id) on delete cascade,
  cv_analysis_id  uuid references public.cv_analyses(id),
  template_id     uuid references public.templates(id),
  payment_id      uuid,
  status          text not null default 'awaiting_payment' check (status in
                    ('awaiting_payment','payment_verified','optimizing','qa_review',
                     'generating_document','completed','failed')),
  prompt_version  text,          -- which prompt set produced this run (Section 24)
  failure_reason  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.generated_documents (
  id                    uuid primary key default gen_random_uuid(),
  optimization_job_id   uuid not null references public.optimization_jobs(id) on delete cascade,
  file_type             text not null check (file_type in ('pdf','docx')),
  storage_path          text not null,
  template_id           uuid references public.templates(id),
  created_at            timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────────────
-- Payments (Section 13) & usage/cost tracking (Sections 14, 29)
-- ────────────────────────────────────────────────────────────────────────

create table public.payments (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  optimization_job_id   uuid references public.optimization_jobs(id),
  paystack_reference    text unique not null,
  amount_kobo           integer not null,
  currency              text not null default 'NGN',
  status                text not null default 'pending' check (status in
                          ('pending','success','failed','abandoned')),
  verified_at           timestamptz,
  raw_webhook_payload   jsonb,
  created_at            timestamptz not null default now()
);

alter table public.optimization_jobs
  add constraint optimization_jobs_payment_id_fkey
  foreign key (payment_id) references public.payments(id);

create table public.ai_usage (
  id                    uuid primary key default gen_random_uuid(),
  optimization_job_id   uuid references public.optimization_jobs(id) on delete cascade,
  stage                 text not null check (stage in
                           ('extraction','job_analysis','matching','gap_analysis','optimization','qa','other')),
  provider              text not null,
  model                 text not null,
  input_tokens          integer not null default 0,
  output_tokens         integer not null default 0,
  estimated_cost_usd    numeric(10,5) not null default 0,
  created_at            timestamptz not null default now()
);

create table public.usage_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  event_type  text not null,      -- e.g. 'cv_uploaded', 'analysis_run', 'download'
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────────────
-- Indexes
-- ────────────────────────────────────────────────────────────────────────

create index idx_uploaded_cvs_user_id            on public.uploaded_cvs(user_id);
create index idx_cv_versions_user_id             on public.cv_versions(user_id);
create index idx_cv_versions_uploaded_cv_id       on public.cv_versions(uploaded_cv_id);
create index idx_job_targets_cv_version_id        on public.job_targets(cv_version_id);
create index idx_job_descriptions_job_target_id   on public.job_descriptions(job_target_id);
create index idx_cv_analyses_cv_version_id        on public.cv_analyses(cv_version_id);
create index idx_cv_analyses_job_target_latest    on public.cv_analyses(job_target_id, created_at desc);
create index idx_optimization_jobs_user_id        on public.optimization_jobs(user_id);
create index idx_optimization_jobs_status         on public.optimization_jobs(status);
create index idx_payments_user_id                 on public.payments(user_id);
create index idx_payments_reference               on public.payments(paystack_reference);
create index idx_ai_usage_optimization_job_id      on public.ai_usage(optimization_job_id);
create index idx_usage_logs_user_id                on public.usage_logs(user_id);

-- ────────────────────────────────────────────────────────────────────────
-- updated_at triggers
-- ────────────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at            before update on public.profiles            for each row execute function public.set_updated_at();
create trigger trg_countries_updated_at           before update on public.countries            for each row execute function public.set_updated_at();
create trigger trg_professions_updated_at         before update on public.professions          for each row execute function public.set_updated_at();
create trigger trg_templates_updated_at           before update on public.templates            for each row execute function public.set_updated_at();
create trigger trg_cv_extracted_data_updated_at   before update on public.cv_extracted_data    for each row execute function public.set_updated_at();
create trigger trg_optimization_jobs_updated_at   before update on public.optimization_jobs    for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────────────────
-- Row Level Security — every user-owned table is owner-only, with an
-- admin override via is_admin(). Reference tables are readable by anyone
-- signed in and writable only by admins.
-- ────────────────────────────────────────────────────────────────────────

alter table public.profiles            enable row level security;
alter table public.admin_users          enable row level security;
alter table public.countries            enable row level security;
alter table public.professions          enable row level security;
alter table public.templates            enable row level security;
alter table public.uploaded_cvs         enable row level security;
alter table public.cv_extracted_data    enable row level security;
alter table public.cv_versions          enable row level security;
alter table public.job_targets          enable row level security;
alter table public.job_descriptions     enable row level security;
alter table public.cv_analyses          enable row level security;
alter table public.optimization_jobs    enable row level security;
alter table public.generated_documents  enable row level security;
alter table public.payments             enable row level security;
alter table public.ai_usage             enable row level security;
alter table public.usage_logs           enable row level security;

create or replace function public.is_admin()
returns boolean as $$
  select exists (select 1 from public.admin_users where id = auth.uid());
$$ language sql security definer stable;

create policy "countries readable"    on public.countries   for select using (true);
create policy "countries admin write" on public.countries   for all    using (public.is_admin()) with check (public.is_admin());

create policy "professions readable"    on public.professions for select using (true);
create policy "professions admin write" on public.professions for all    using (public.is_admin()) with check (public.is_admin());

create policy "templates readable"    on public.templates for select using (true);
create policy "templates admin write" on public.templates for all    using (public.is_admin()) with check (public.is_admin());

create policy "profiles self read"   on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);
create policy "profiles self insert" on public.profiles for insert with check (auth.uid() = id);

create policy "admin_users admin read" on public.admin_users for select using (public.is_admin());

create policy "uploaded_cvs owner" on public.uploaded_cvs for all
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id);

create policy "cv_extracted_data owner" on public.cv_extracted_data for all
  using (exists (select 1 from public.uploaded_cvs c where c.id = uploaded_cv_id and (c.user_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.uploaded_cvs c where c.id = uploaded_cv_id and c.user_id = auth.uid()));

create policy "cv_versions owner" on public.cv_versions for all
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id);

create policy "job_targets owner" on public.job_targets for all
  using (exists (select 1 from public.cv_versions v where v.id = cv_version_id and (v.user_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.cv_versions v where v.id = cv_version_id and v.user_id = auth.uid()));

create policy "job_descriptions owner" on public.job_descriptions for all
  using (exists (select 1 from public.job_targets t join public.cv_versions v on v.id = t.cv_version_id
                 where t.id = job_target_id and (v.user_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.job_targets t join public.cv_versions v on v.id = t.cv_version_id
                       where t.id = job_target_id and v.user_id = auth.uid()));

create policy "cv_analyses owner" on public.cv_analyses for all
  using (exists (select 1 from public.cv_versions v where v.id = cv_version_id and (v.user_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.cv_versions v where v.id = cv_version_id and v.user_id = auth.uid()));

create policy "optimization_jobs owner" on public.optimization_jobs for all
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id);

create policy "generated_documents owner" on public.generated_documents for all
  using (exists (select 1 from public.optimization_jobs j where j.id = optimization_job_id and (j.user_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.optimization_jobs j where j.id = optimization_job_id and j.user_id = auth.uid()));

-- Payments and cost/usage logs are written only by server-side code using the
-- service role key (which bypasses RLS entirely) — see src/lib/supabase/server.ts
-- and ARCHITECTURE.md § Payment architecture. Regular users get read-only policies.
create policy "payments owner read" on public.payments for select
  using (auth.uid() = user_id or public.is_admin());

create policy "ai_usage admin only"   on public.ai_usage   for select using (public.is_admin());
create policy "usage_logs admin only" on public.usage_logs for select using (public.is_admin());
