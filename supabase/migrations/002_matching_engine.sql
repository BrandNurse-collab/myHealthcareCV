-- 002 — CV matching engine
--
-- For a database that already ran the original supabase/schema.sql (which
-- defined a leaner cv_analyses table). A brand-new project doesn't need this
-- file: the updated schema.sql already includes every column below.
--
-- Safe to run more than once. Existing rows, foreign keys, and RLS policies
-- are untouched — the "cv_analyses owner" policy is row-level and covers the
-- new columns automatically.

alter table public.cv_analyses
  add column if not exists certification_gaps jsonb not null default '[]',
  add column if not exists education_gaps     jsonb not null default '[]',
  add column if not exists experience_gaps    jsonb not null default '[]',
  add column if not exists recommendations    jsonb not null default '[]',
  add column if not exists scoring_notes      text,
  add column if not exists basis              text,
  add column if not exists prompt_version     text;

alter table public.cv_analyses
  drop constraint if exists cv_analyses_basis_check;
alter table public.cv_analyses
  add constraint cv_analyses_basis_check
  check (basis is null or basis in ('job_description','title_only'));

create index if not exists idx_cv_analyses_job_target_latest
  on public.cv_analyses(job_target_id, created_at desc);
