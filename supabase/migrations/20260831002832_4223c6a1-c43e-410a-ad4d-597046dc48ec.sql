ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS reference text;

-- Preserve existing applicants' current numbers so their stored folders and PDF links keep working.
UPDATE public.applications
SET reference = 'ELV-' || upper(substring(replace(id::text, '-', '') from 1 for 8))
WHERE reference IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS applications_reference_key ON public.applications (reference);

DROP VIEW IF EXISTS public.application_review_queue;

CREATE VIEW public.application_review_queue
WITH (security_invoker = true) AS
SELECT
  a.reference AS reference_number,
  (a.first_name || ' ' || a.last_name) AS applicant_name,
  a.email AS applicant_email,
  a.phone AS applicant_phone,
  a.created_at AS submitted_at,
  a.status AS application_status,
  a.id AS application_id,
  f.id AS flag_id,
  COALESCE(f.question, 'No HR-review flags') AS flag_question,
  COALESCE(f.answer, 'No HR-review flags') AS flagged_response,
  f.created_at AS flag_created_at
FROM public.applications a
LEFT JOIN public.hr_review_flags f ON f.application_id = a.id;