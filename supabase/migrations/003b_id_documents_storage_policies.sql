-- Storage policies for the "id-documents" bucket.
-- Run AFTER creating the bucket in the Supabase dashboard.

-- 1. Upload — authenticated users can upload to their own folder only
create policy "id-documents: owner can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'id-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 2. Update — authenticated users can replace their own files (retake)
create policy "id-documents: owner can update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'id-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 3. Delete — authenticated users can delete their own files
create policy "id-documents: owner can delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'id-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- No SELECT policy — only service_role (admin) can read these files.
