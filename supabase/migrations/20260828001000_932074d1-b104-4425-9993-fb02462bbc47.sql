REVOKE SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.applications FROM anon, authenticated;
REVOKE SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.hr_review_flags FROM anon, authenticated;
GRANT INSERT ON public.applications TO anon, authenticated;
GRANT INSERT ON public.hr_review_flags TO anon, authenticated;