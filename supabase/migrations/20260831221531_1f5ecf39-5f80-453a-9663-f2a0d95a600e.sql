ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS sms_consent boolean,
  ADD COLUMN IF NOT EXISTS sms_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_consent_text text,
  ADD COLUMN IF NOT EXISTS sms_consent_phone text,
  ADD COLUMN IF NOT EXISTS sms_consent_version text,
  ADD COLUMN IF NOT EXISTS sms_opt_out_at timestamptz;

CREATE TABLE IF NOT EXISTS public.sms_consent_declines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id text,
  phone text,
  selection text NOT NULL,
  consent_text text NOT NULL,
  application_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.sms_consent_declines TO anon, authenticated;
GRANT SELECT ON public.sms_consent_declines TO authenticated;
GRANT ALL ON public.sms_consent_declines TO service_role;
ALTER TABLE public.sms_consent_declines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can record a declined text-consent attempt" ON public.sms_consent_declines;
CREATE POLICY "Public can record a declined text-consent attempt"
  ON public.sms_consent_declines FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can view declined text-consent attempts" ON public.sms_consent_declines;
CREATE POLICY "Staff can view declined text-consent attempts"
  ON public.sms_consent_declines FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));