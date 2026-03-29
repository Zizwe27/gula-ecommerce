-- Migration 003 — Add ID document URL to seller applications

alter table seller_applications
  add column id_document_url text;   -- Supabase Storage path, private bucket

-- Storage bucket setup (run via Supabase dashboard or Storage API):
-- Bucket name: "id-documents"
-- Public: false  ← private, admin access only
-- Allowed MIME types: image/jpeg, image/png, image/webp
-- Max file size: 10MB
--
-- RLS policies for the bucket (set in Storage → Policies):
-- INSERT: authenticated users can upload to their own folder
--   (bucket_id = 'id-documents' AND auth.uid()::text = (storage.foldername(name))[1])
-- SELECT: service_role only (admin dashboard reads via service key)
-- DELETE: authenticated users can delete their own uploads
--   (bucket_id = 'id-documents' AND auth.uid()::text = (storage.foldername(name))[1])
