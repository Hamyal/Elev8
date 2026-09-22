CREATE TABLE public.applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'submitted',
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  opportunity_pref text,
  typed_name text,
  resume_path text,
  class_schedule_path text,
  application_data jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT INSERT ON public.applications TO anon, authenticated;
GRANT ALL ON public.applications TO service_role;

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an application"
  ON public.applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE TABLE public.hr_review_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.hr_review_flags TO anon, authenticated;
GRANT ALL ON public.hr_review_flags TO service_role;

ALTER TABLE public.hr_review_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an HR review flag"
  ON public.hr_review_flags FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX idx_hr_review_flags_application_id ON public.hr_review_flags(application_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();