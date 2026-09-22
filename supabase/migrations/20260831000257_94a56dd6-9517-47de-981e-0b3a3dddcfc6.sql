CREATE OR REPLACE VIEW public.application_review_queue
WITH (security_invoker = true) AS
SELECT
  'ELV-' || upper(substr(replace(a.id::text, '-', ''), 1, 8)) AS reference_number,
  btrim(a.first_name || ' ' || a.last_name)                   AS applicant_name,
  a.email                                                     AS applicant_email,
  a.phone                                                     AS applicant_phone,
  a.created_at                                                AS submitted_at,
  a.status                                                    AS application_status,
  COALESCE(f.question, 'No HR-review flags')                  AS flag_question,
  COALESCE(f.answer, '—')                                     AS flagged_response,
  f.created_at                                                AS flag_created_at,
  a.id                                                        AS application_id,
  f.id                                                        AS flag_id
FROM public.applications a
LEFT JOIN public.hr_review_flags f ON f.application_id = a.id;

GRANT SELECT ON public.application_review_queue TO authenticated;
GRANT SELECT ON public.application_review_queue TO service_role;