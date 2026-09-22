-- Applicants (unauthenticated) may only upload certification files into the
-- private "certifications" bucket. No read, update, or delete access is
-- granted to anon/authenticated, so files are never publicly reachable.
CREATE POLICY "Applicants can upload certification files"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'certifications'
  AND (storage.foldername(name))[1] = 'pending'
);