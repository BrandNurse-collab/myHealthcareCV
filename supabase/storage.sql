-- Storage: a single private bucket for uploaded CVs and generated documents.
-- Objects are stored at "{auth.uid()}/{uuid}/{filename}" — the leading
-- folder segment IS the owner check the policies below key off of, via
-- storage.foldername(name), so there's nothing else to keep in sync.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cvs',
  'cvs',
  false,
  10485760, -- 10 MB, matches CV_MAX_FILE_SIZE_BYTES in application code
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

create policy "cv storage insert own" on storage.objects for insert
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "cv storage select own" on storage.objects for select
  using (bucket_id = 'cvs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create policy "cv storage update own" on storage.objects for update
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "cv storage delete own" on storage.objects for delete
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);
