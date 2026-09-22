-- Approved View Progress milestone sequence.
-- Additive and non-destructive: legacy catalog rows are retained (pushed to
-- high ordinals) so historical milestone/event rows keep their labels.

-- 1. Push legacy milestone catalog rows out of the working sequence.
update public.milestone_catalog
   set ordinal = 900 + ordinal
 where milestone_key in (
   'initial_outreach_pending','initial_text_sent','second_outreach_pending','second_outreach_sent',
   'phone_availability_received','screening_decision_pending',
   'interview1_availability_requested','interview1_availability_received','interview1_scheduled',
   'interview1_confirmation_pending','interview1_confirmed','interview1_completed','interview1_decision_pending',
   'interview2_materials_pending','interview2_materials_sent','interview2_availability_requested',
   'interview2_availability_received','interview2_scheduled','interview2_confirmation_pending',
   'interview2_confirmed','interview2_completed','interview2_decision_pending',
   'verbal_offer_pending','verbal_offer_extended','verbal_offer_accepted','verbal_offer_declined',
   'onboarding_initiated','onboarding_in_progress','onboarding_completed',
   'phone_interview_scheduled','phone_interview_confirmed','phone_interview_completed'
 )
   and ordinal < 900;

-- 2. Approved sequence.
insert into public.milestone_catalog
  (status_key, milestone_key, ordinal, label, requires_explanation, awaiting_applicant)
values
  ('new', 'application_received', 0, 'Application received', false, false),

  ('screening', 'initial_outreach', 10, 'Initial outreach', false, false),
  ('screening', 'applicant_response_received', 11, 'Applicant response received', false, true),
  ('screening', 'phone_interview_scheduled_v2', 12, 'Phone interview scheduled', false, false),
  ('screening', 'phone_interview_confirmed_v2', 13, 'Phone interview confirmed', false, true),
  ('screening', 'phone_interview_completed_v2', 14, 'Phone interview completed', false, false),
  ('screening', 'screening_decision_recorded', 15, 'Screening decision recorded', false, false),

  ('interview_1', 'i1_availability_requested', 20, 'Availability requested', false, true),
  ('interview_1', 'i1_availability_received', 21, 'Availability received', false, false),
  ('interview_1', 'i1_interview_scheduled', 22, 'Interview scheduled', false, false),
  ('interview_1', 'i1_interview_confirmed', 23, 'Interview confirmed', false, true),
  ('interview_1', 'i1_interview_completed', 24, 'Interview completed', false, false),
  ('interview_1', 'i1_decision_recorded', 25, 'Interview decision recorded', false, false),

  ('interview_2', 'i2_materials_sent', 30, 'Materials sent', false, false),
  ('interview_2', 'i2_availability_requested', 31, 'Availability requested', false, true),
  ('interview_2', 'i2_availability_received', 32, 'Availability received', false, false),
  ('interview_2', 'i2_interview_scheduled', 33, 'Interview scheduled', false, false),
  ('interview_2', 'i2_interview_confirmed', 34, 'Interview confirmed', false, true),
  ('interview_2', 'i2_interview_completed', 35, 'Interview completed', false, false),
  ('interview_2', 'i2_decision_recorded', 36, 'Interview decision recorded', false, false),

  ('offer', 'offer_call_scheduled', 40, 'Verbal offer call scheduled', false, false),
  ('offer', 'offer_extended', 41, 'Verbal offer extended', false, true),
  ('offer', 'offer_decision_received', 42, 'Applicant decision received', false, true),
  ('offer', 'offer_handoff_completed', 43, 'Onboarding handoff completed', false, false),

  ('hired', 'hired_onboarding_initiated', 50, 'Onboarding initiated', false, false),
  ('hired', 'hired_onboarding_in_progress', 51, 'Onboarding in progress', false, false),
  ('hired', 'hired_cleared_to_work', 52, 'Cleared to begin work', false, false),
  ('hired', 'hired_start_date_scheduled', 53, 'Start date scheduled', false, false),
  ('hired', 'hired_onboarding_completed', 54, 'Onboarding completed', false, false)
on conflict (milestone_key) do update
  set status_key = excluded.status_key,
      ordinal = excluded.ordinal,
      label = excluded.label,
      requires_explanation = excluded.requires_explanation,
      awaiting_applicant = excluded.awaiting_applicant;

-- Terminal closure reasons keep their meaning, after the working sequence.
update public.milestone_catalog set ordinal = 60 where milestone_key = 'closed_no_response';
update public.milestone_catalog set ordinal = 61 where milestone_key = 'closed_qualifications';
update public.milestone_catalog set ordinal = 62 where milestone_key = 'closed_availability';
update public.milestone_catalog set ordinal = 63 where milestone_key = 'closed_phone_interview_outcome';
update public.milestone_catalog set ordinal = 64 where milestone_key = 'closed_interview1_outcome';
update public.milestone_catalog set ordinal = 65 where milestone_key = 'closed_interview2_outcome';
update public.milestone_catalog set ordinal = 66 where milestone_key = 'closed_offer_declined';
update public.milestone_catalog set ordinal = 67 where milestone_key = 'closed_other';

-- 3. Map only the CURRENT milestone of each application. History untouched.
create temporary table _milestone_map (old_key text primary key, new_key text not null) on commit drop;
insert into _milestone_map (old_key, new_key) values
  ('initial_outreach_pending', 'initial_outreach'),
  ('initial_text_sent', 'applicant_response_received'),
  ('second_outreach_pending', 'applicant_response_received'),
  ('second_outreach_sent', 'applicant_response_received'),
  ('phone_availability_received', 'phone_interview_scheduled_v2'),
  ('phone_interview_scheduled', 'phone_interview_scheduled_v2'),
  ('phone_interview_confirmed', 'phone_interview_confirmed_v2'),
  ('phone_interview_completed', 'phone_interview_completed_v2'),
  ('screening_decision_pending', 'screening_decision_recorded'),
  ('interview1_availability_requested', 'i1_availability_requested'),
  ('interview1_availability_received', 'i1_availability_received'),
  ('interview1_scheduled', 'i1_interview_scheduled'),
  ('interview1_confirmation_pending', 'i1_interview_scheduled'),
  ('interview1_confirmed', 'i1_interview_confirmed'),
  ('interview1_completed', 'i1_interview_completed'),
  ('interview1_decision_pending', 'i1_decision_recorded'),
  ('interview2_materials_pending', 'i2_materials_sent'),
  ('interview2_materials_sent', 'i2_availability_requested'),
  ('interview2_availability_requested', 'i2_availability_requested'),
  ('interview2_availability_received', 'i2_availability_received'),
  ('interview2_scheduled', 'i2_interview_scheduled'),
  ('interview2_confirmation_pending', 'i2_interview_scheduled'),
  ('interview2_confirmed', 'i2_interview_confirmed'),
  ('interview2_completed', 'i2_interview_completed'),
  ('interview2_decision_pending', 'i2_decision_recorded'),
  ('verbal_offer_pending', 'offer_call_scheduled'),
  ('verbal_offer_extended', 'offer_extended'),
  ('verbal_offer_accepted', 'offer_decision_received'),
  ('verbal_offer_declined', 'offer_decision_received'),
  ('onboarding_initiated', 'hired_onboarding_initiated'),
  ('onboarding_in_progress', 'hired_onboarding_in_progress'),
  ('onboarding_completed', 'hired_onboarding_completed');

-- Internal audit trail of the mapping (one row per remapped application).
insert into public.application_events
  (application_id, actor_id, event_type, from_status, to_status, detail, is_internal)
select a.id, null, 'workflow_override', a.status, a.status,
       'Hiring progress redesign: current milestone mapped from "'
       || coalesce((select label from public.milestone_catalog c where c.milestone_key = a.current_milestone), a.current_milestone)
       || '" to "' || (select label from public.milestone_catalog c where c.milestone_key = m.new_key) || '".',
       true
  from public.applications a
  join _milestone_map m on m.old_key = a.current_milestone;

-- Flag genuinely ambiguous current milestones for administrator review instead of guessing.
insert into public.application_events
  (application_id, actor_id, event_type, from_status, to_status, detail, is_internal)
select a.id, null, 'workflow_override', a.status, a.status,
       'Hiring progress redesign: current milestone "' || a.current_milestone
       || '" has no approved equivalent and was preserved unchanged. Administrator review required.',
       true
  from public.applications a
 where a.current_milestone is not null
   and not exists (select 1 from _milestone_map m where m.old_key = a.current_milestone)
   and not exists (select 1 from public.milestone_catalog c
                    where c.milestone_key = a.current_milestone and c.ordinal < 900);

update public.applications a
   set current_milestone = m.new_key,
       updated_at = now()
  from _milestone_map m
 where m.old_key = a.current_milestone;

-- Only the still-active trail row moves; completed history is left alone.
update public.application_milestones t
   set milestone_key = m.new_key
  from _milestone_map m
 where m.old_key = t.milestone_key
   and t.completed_at is null
   and t.state = 'active';

-- 4. Interview #2 entry now lands on the approved "Materials sent" milestone.
create or replace function public.advance_to_interview_2(_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _old text;
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized to advance applicants';
  end if;

  select status into _old from public.applications where id = _application_id;
  if _old is null then
    raise exception 'Application not found';
  end if;

  if not exists (
    select 1 from public.application_milestones
     where application_id = _application_id
       and milestone_key in ('i1_interview_completed', 'interview1_completed')
       and completed_at is not null
  ) then
    raise exception 'Interview #1 must be marked completed before advancing to Interview #2.';
  end if;

  update public.applications
     set status = 'interview_2',
         current_milestone = 'i2_materials_sent',
         next_action = 'Send the approved Interview #2 materials message to the applicant.',
         milestone_due_at = null,
         milestone_completed_at = null,
         updated_at = now()
   where id = _application_id;

  insert into public.application_milestones
    (application_id, status_key, milestone_key, assigned_to, assigned_at, next_action, state)
  select _application_id, 'interview_2', 'i2_materials_sent', a.assigned_to, a.assigned_at,
         'Send the approved Interview #2 materials message to the applicant.', 'active'
    from public.applications a where a.id = _application_id;

  insert into public.application_events (application_id, actor_id, event_type, from_status, to_status, detail, is_internal)
  values (_application_id, auth.uid(), 'advanced_to_interview_2', _old, 'interview_2',
          coalesce((select coalesce(full_name, email) from public.staff_profiles where user_id = auth.uid()), 'Staff')
          || ' advanced this applicant to Interview #2', false);
end;
$$;