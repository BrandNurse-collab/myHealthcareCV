-- 003 — fix the CV extraction upsert
--
-- process-extraction.ts has always upserted onConflict "uploaded_cv_id",
-- but schema.sql never actually gave that column a unique constraint.
-- Postgres refuses ON CONFLICT (column) outright without one — not just on
-- a real duplicate, every single time — which is why CV extraction has
-- been failing for every attempt, regardless of AI provider. This was
-- never caught in testing because every automated test used a mocked
-- Supabase client that doesn't enforce real Postgres constraint rules.
--
-- Safe to run more than once. If it fails with "could not create unique
-- index" / "duplicate key", that means cv_extracted_data already has more
-- than one row for the same uploaded_cv_id — given the bug this fixes,
-- that shouldn't be possible (the upsert has always failed before any row
-- was written), but if it happens, keep only the newest row per
-- uploaded_cv_id and re-run this file.

alter table public.cv_extracted_data
  add constraint cv_extracted_data_uploaded_cv_id_key unique (uploaded_cv_id);
