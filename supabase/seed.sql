-- Illustrative starting data only. None of this restricts user input —
-- see Sections 3 and 22 of the product spec. Add more via the admin
-- dashboard once Phase 7 ships; this file just gets local dev unblocked.

insert into public.countries (code, name) values
  ('NG', 'Nigeria'),
  ('GB', 'United Kingdom'),
  ('US', 'United States'),
  ('CA', 'Canada'),
  ('AU', 'Australia'),
  ('AE', 'United Arab Emirates'),
  ('ZA', 'South Africa'),
  ('DE', 'Germany'),
  ('NO', 'Norway'),
  ('SA', 'Saudi Arabia')
on conflict (code) do nothing;

insert into public.professions (name, category, is_featured) values
  ('Registered Nurse', 'Nursing', true),
  ('Public Health Specialist', 'Public Health', true),
  ('Health Information Manager', 'Health Informatics', true),
  ('HMO / Health Insurance Operations', 'Health Insurance', true),
  ('Biomedical Scientist', 'Clinical Science', true),
  ('Physiotherapist', 'Allied Health', true),
  ('Doctor', 'Medicine', true),
  ('Pharmacist', 'Pharmacy', true),
  ('Healthcare Data Analyst', 'Digital Health', true),
  ('Hospital Administrator', 'Administration', true)
on conflict do nothing;

insert into public.templates (slug, name, category, description) values
  ('ats-focused', 'ATS-Focused', 'ATS-focused', 'Single-column, no tables or graphics — built to parse cleanly through applicant tracking systems.'),
  ('professional', 'Professional', 'Professional', 'General-purpose professional layout for most healthcare and adjacent roles.'),
  ('academic', 'Academic / Research', 'Academic', 'Emphasizes publications, research experience, and academic appointments.')
on conflict (slug) do nothing;
