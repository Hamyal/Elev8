-- Fix: Interview #2 materials could never be sent.
--
-- send_interview_materials() gated on the milestone key 'interview1_completed'.
-- That key was renamed to 'i1_interview_completed' when the interview stages
-- were split, and advance_to_interview_2() was updated to accept both spellings
-- (see 20260909002137) -- but this function was not.
--
-- The result: every applicant progressing through the current workflow records
-- 'i1_interview_completed' and never 'interview1_completed', so the guard could
-- not be satisfied and the function raised for every current record. Only
-- applications created before the rename could pass it.
--
-- This restores the function unchanged except for the guard, which now accepts
-- both the current and the legacy key, exactly as advance_to_interview_2 does.

CREATE OR REPLACE FUNCTION public.send_interview_materials(
  _application_id uuid,
  _materials_url text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  _id uuid;
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized to send interview materials';
  end if;

  -- Interview #2 materials unlock only after Interview #1 is completed.
  -- Both the current key and the pre-split key count.
  if not exists (
    select 1 from public.application_milestones m
     where m.application_id = _application_id
       and m.milestone_key in ('i1_interview_completed', 'interview1_completed')
       and m.completed_at is not null
  ) then
    raise exception 'Interview #1 must be completed before Interview #2 materials can be sent';
  end if;

  insert into public.interview_materials (application_id, materials_url, sent_by)
  values (_application_id, _materials_url, auth.uid())
  returning id into _id;

  insert into public.application_events (application_id, actor_id, event_type, detail, is_internal)
  values (_application_id, auth.uid(), 'materials_sent', 'Interview #2 materials', false);

  return _id;
end;
$$;
