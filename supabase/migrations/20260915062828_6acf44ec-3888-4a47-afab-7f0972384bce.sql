-- 1. New Interview #1 milestone: candidate confirmation received.
UPDATE public.milestone_catalog SET ordinal = ordinal + 1 WHERE ordinal >= 11 AND ordinal < 900;

INSERT INTO public.milestone_catalog (milestone_key, status_key, ordinal, label, requires_explanation, awaiting_applicant)
VALUES ('i1_confirmation_received', 'interview_1', 11, 'Candidate confirmation received', false, true)
ON CONFLICT (milestone_key) DO NOTHING;

-- 2. Confirmed availability slots (parsed from the candidate's reply, human-confirmed).
CREATE TABLE public.interview_confirmed_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'interview_1',
  slot_date date NOT NULL,
  slot_time time NOT NULL,
  source text NOT NULL DEFAULT 'parsed',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, kind, slot_date, slot_time)
);

GRANT SELECT ON public.interview_confirmed_slots TO authenticated;
GRANT ALL ON public.interview_confirmed_slots TO service_role;
ALTER TABLE public.interview_confirmed_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read confirmed slots" ON public.interview_confirmed_slots
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE INDEX interview_confirmed_slots_date_idx ON public.interview_confirmed_slots (kind, slot_date, slot_time);

-- 3. The single booked slot per applicant and stage.
CREATE TABLE public.interview_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'interview_1',
  slot_date date NOT NULL,
  slot_time time NOT NULL,
  facility text NOT NULL,
  confirm_by time,
  booked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, kind)
);

GRANT SELECT ON public.interview_bookings TO authenticated;
GRANT ALL ON public.interview_bookings TO service_role;
ALTER TABLE public.interview_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read interview bookings" ON public.interview_bookings
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TRIGGER update_interview_bookings_updated_at
  BEFORE UPDATE ON public.interview_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX interview_bookings_date_idx ON public.interview_bookings (kind, slot_date, slot_time);

-- 4. Controlled writes.
CREATE OR REPLACE FUNCTION public.save_confirmed_slots(
  _application_id uuid,
  _kind text,
  _slots jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _slot jsonb;
BEGIN
  IF NOT public.can_review(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to record confirmed interview slots.';
  END IF;
  IF _kind NOT IN ('interview_1', 'interview_2') THEN
    RAISE EXCEPTION 'Unsupported interview stage.';
  END IF;

  DELETE FROM public.interview_confirmed_slots
    WHERE application_id = _application_id AND kind = _kind;

  FOR _slot IN SELECT * FROM jsonb_array_elements(coalesce(_slots, '[]'::jsonb))
  LOOP
    INSERT INTO public.interview_confirmed_slots (application_id, kind, slot_date, slot_time, source)
    VALUES (
      _application_id,
      _kind,
      (_slot->>'date')::date,
      (_slot->>'time')::time,
      coalesce(_slot->>'source', 'parsed')
    )
    ON CONFLICT (application_id, kind, slot_date, slot_time) DO NOTHING;
  END LOOP;

  INSERT INTO public.application_events (application_id, actor_id, event_type, detail, is_internal)
  VALUES (
    _application_id,
    auth.uid(),
    'scheduling_updated',
    'Confirmed interview availability recorded (' || jsonb_array_length(coalesce(_slots, '[]'::jsonb)) || ' slot(s)).',
    false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.book_interview_slot(
  _application_id uuid,
  _kind text,
  _slot_date date,
  _slot_time time,
  _facility text,
  _confirm_by time
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_review(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to book interview slots.';
  END IF;
  IF _kind NOT IN ('interview_1', 'interview_2') THEN
    RAISE EXCEPTION 'Unsupported interview stage.';
  END IF;

  INSERT INTO public.interview_bookings (application_id, kind, slot_date, slot_time, facility, confirm_by, booked_by)
  VALUES (_application_id, _kind, _slot_date, _slot_time, _facility, _confirm_by, auth.uid())
  ON CONFLICT (application_id, kind) DO UPDATE
    SET slot_date = excluded.slot_date,
        slot_time = excluded.slot_time,
        facility = excluded.facility,
        confirm_by = excluded.confirm_by,
        booked_by = excluded.booked_by,
        updated_at = now();

  INSERT INTO public.application_events (application_id, actor_id, event_type, detail, is_internal)
  VALUES (
    _application_id,
    auth.uid(),
    'scheduling_updated',
    'Interview slot booked: ' || to_char(_slot_date, 'FMDay, FMMonth DD') || ' at ' || to_char(_slot_time, 'FMHH12:MI AM') || ' — ' || _facility || '.',
    false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.unbook_interview_slot(
  _application_id uuid,
  _kind text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_review(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to undo interview bookings.';
  END IF;

  DELETE FROM public.interview_bookings
    WHERE application_id = _application_id AND kind = _kind;

  INSERT INTO public.application_events (application_id, actor_id, event_type, detail, is_internal)
  VALUES (_application_id, auth.uid(), 'scheduling_updated', 'Interview booking undone.', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_confirmed_interview_slots(_kind text)
RETURNS TABLE (
  application_id uuid,
  applicant_name text,
  reference text,
  slot_date date,
  slot_time time,
  booked boolean,
  booked_date date,
  booked_time time,
  facility text,
  confirm_by time
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.application_id,
         a.first_name || ' ' || a.last_name,
         a.reference,
         s.slot_date,
         s.slot_time,
         b.id IS NOT NULL,
         b.slot_date,
         b.slot_time,
         b.facility,
         b.confirm_by
  FROM public.interview_confirmed_slots s
  JOIN public.applications a ON a.id = s.application_id
  LEFT JOIN public.interview_bookings b
    ON b.application_id = s.application_id AND b.kind = s.kind
  WHERE s.kind = _kind
    AND public.is_staff(auth.uid())
  ORDER BY s.slot_date, s.slot_time, a.first_name;
$$;

REVOKE ALL ON FUNCTION public.save_confirmed_slots(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.book_interview_slot(uuid, text, date, time, text, time) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unbook_interview_slot(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_confirmed_interview_slots(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_confirmed_slots(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_interview_slot(uuid, text, date, time, text, time) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unbook_interview_slot(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_confirmed_interview_slots(text) TO authenticated;