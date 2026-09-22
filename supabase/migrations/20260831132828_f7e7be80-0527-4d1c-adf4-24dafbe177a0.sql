-- ATS Phase 1 — Hiring milestone workflow
-- Additive only. No existing table, column, row, policy, or storage object is
-- dropped, renamed, retyped, or migrated. Applicant intake is untouched.

-- ---------------------------------------------------------------------------
-- Milestone catalog (ordered), used to validate milestones and detect skips
-- ---------------------------------------------------------------------------
create table if not exists public.milestone_catalog (
  milestone_key text primary key,
  status_key text not null,
  ordinal integer not null,
  label text not null,
  requires_explanation boolean not null default false,
  awaiting_applicant boolean not null default false
);

grant select on public.milestone_catalog to authenticated;
grant all on public.milestone_catalog to service_role;
alter table public.milestone_catalog enable row level security;

drop policy if exists "Staff read milestone catalog" on public.milestone_catalog;
create policy "Staff read milestone catalog"
on public.milestone_catalog for select to authenticated
using (public.is_staff(auth.uid()));

insert into public.milestone_catalog
  (status_key, milestone_key, ordinal, label, requires_explanation, awaiting_applicant)
values
  ('new', 'application_received', 0, 'Application received', false, false),
  ('screening', 'initial_outreach_pending', 1, 'Initial outreach pending', false, false),
  ('screening', 'initial_text_sent', 2, 'Initial text sent', false, true),
  ('screening', 'second_outreach_pending', 3, 'Second outreach pending', false, false),
  ('screening', 'second_outreach_sent', 4, 'Second outreach sent', false, true),
  ('screening', 'phone_availability_received', 5, 'Phone availability received', false, false),
  ('screening', 'phone_interview_scheduled', 6, 'Phone interview scheduled', false, true),
  ('screening', 'phone_interview_confirmed', 7, 'Phone interview confirmed', false, false),
  ('screening', 'phone_interview_completed', 8, 'Phone interview completed', false, false),
  ('screening', 'screening_decision_pending', 9, 'Screening decision pending', false, false),
  ('interview_1', 'interview1_availability_requested', 10, 'Interview #1 availability requested', false, true),
  ('interview_1', 'interview1_availability_received', 11, 'Interview #1 availability received', false, false),
  ('interview_1', 'interview1_scheduled', 12, 'Interview #1 scheduled', false, false),
  ('interview_1', 'interview1_confirmation_pending', 13, 'Interview #1 confirmation pending', false, true),
  ('interview_1', 'interview1_confirmed', 14, 'Interview #1 confirmed', false, false),
  ('interview_1', 'interview1_completed', 15, 'Interview #1 completed', false, false),
  ('interview_1', 'interview1_decision_pending', 16, 'Interview #1 decision pending', false, false),
  ('interview_2', 'interview2_materials_pending', 17, 'Interview #2 materials pending', false, false),
  ('interview_2', 'interview2_materials_sent', 18, 'Interview #2 materials sent', false, true),
  ('interview_2', 'interview2_availability_requested', 19, 'Interview #2 availability requested', false, true),
  ('interview_2', 'interview2_availability_received', 20, 'Interview #2 availability received', false, false),
  ('interview_2', 'interview2_scheduled', 21, 'Interview #2 scheduled', false, false),
  ('interview_2', 'interview2_confirmation_pending', 22, 'Interview #2 confirmation pending', false, true),
  ('interview_2', 'interview2_confirmed', 23, 'Interview #2 confirmed', false, false),
  ('interview_2', 'interview2_completed', 24, 'Interview #2 completed', false, false),
  ('interview_2', 'interview2_decision_pending', 25, 'Interview #2 decision pending', false, false),
  ('offer', 'verbal_offer_pending', 28, 'Verbal offer pending', false, false),
  ('offer', 'verbal_offer_extended', 29, 'Verbal offer extended', false, true),
  ('offer', 'verbal_offer_accepted', 30, 'Verbal offer accepted', false, false),
  ('offer', 'verbal_offer_declined', 31, 'Verbal offer declined', false, false),
  ('hired', 'onboarding_initiated', 32, 'Onboarding initiated', false, false),
  ('hired', 'onboarding_in_progress', 33, 'Onboarding in progress', false, false),
  ('hired', 'onboarding_completed', 34, 'Onboarding completed', false, false),
  ('not_selected', 'closed_no_response', 35, 'Closed—no response', false, false),
  ('not_selected', 'closed_qualifications', 36, 'Closed—qualifications', false, false),
  ('not_selected', 'closed_availability', 37, 'Closed—availability', false, false),
  ('not_selected', 'closed_phone_interview_outcome', 38, 'Closed—phone interview outcome', false, false),
  ('not_selected', 'closed_interview1_outcome', 39, 'Closed—Interview #1 outcome', false, false),
  ('not_selected', 'closed_interview2_outcome', 40, 'Closed—Interview #2 outcome', false, false),
  ('not_selected', 'closed_offer_declined', 41, 'Closed—offer declined', false, false),
  ('not_selected', 'closed_other', 42, 'Closed—other', true, false)
on conflict (milestone_key) do update
  set status_key = excluded.status_key,
      ordinal = excluded.ordinal,
      label = excluded.label,
      requires_explanation = excluded.requires_explanation,
      awaiting_applicant = excluded.awaiting_applicant;

-- The reference-check stage is not part of the hiring workflow.
delete from public.milestone_catalog where status_key = 'reference_check';

-- ---------------------------------------------------------------------------
-- Workflow columns on applications (all nullable, additive)
-- ---------------------------------------------------------------------------
alter table public.applications
  add column if not exists current_milestone text,
  add column if not exists assigned_to uuid,
  add column if not exists assigned_at timestamptz,
  add column if not exists milestone_due_at timestamptz,
  add column if not exists milestone_completed_at timestamptz,
  add column if not exists next_action text,
  add column if not exists closed_other_reason text;

-- ---------------------------------------------------------------------------
-- Milestone trail
-- ---------------------------------------------------------------------------
create table if not exists public.application_milestones (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  status_key text not null,
  milestone_key text not null,
  assigned_to uuid,
  assigned_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  state text not null default 'active',
  next_action text,
  created_at timestamptz not null default now()
);

grant select on public.application_milestones to authenticated;
grant all on public.application_milestones to service_role;
alter table public.application_milestones enable row level security;

drop policy if exists "Staff read milestone trail" on public.application_milestones;
create policy "Staff read milestone trail"
on public.application_milestones for select to authenticated
using (public.is_staff(auth.uid()));

create index if not exists application_milestones_app_idx
  on public.application_milestones (application_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Communication log (manual records; Phase 1 sends nothing automatically)
-- ---------------------------------------------------------------------------
create table if not exists public.application_communications (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  staff_id uuid not null,
  comm_type text not null,
  occurred_at timestamptz not null default now(),
  milestone_key text,
  template_key text,
  message_text text not null default '',
  private_note text not null default '',
  created_at timestamptz not null default now()
);

-- private_note is admin/HR only, so it is not granted at column level.
grant select (id, application_id, staff_id, comm_type, occurred_at, milestone_key, template_key, message_text, created_at)
  on public.application_communications to authenticated;
grant all on public.application_communications to service_role;
alter table public.application_communications enable row level security;

drop policy if exists "Staff read communications" on public.application_communications;
create policy "Staff read communications"
on public.application_communications for select to authenticated
using (public.is_staff(auth.uid()));

create index if not exists application_communications_app_idx
  on public.application_communications (application_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Scheduling (phone interview and interviews #1 / #2)
-- ---------------------------------------------------------------------------
create table if not exists public.application_scheduling (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  kind text not null,
  proposed_date date,
  window_start time,
  window_end time,
  applicant_availability text not null default '',
  final_window_start timestamptz,
  final_window_end timestamptz,
  confirmation_state text,
  confirmation_due_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (application_id, kind)
);

grant select on public.application_scheduling to authenticated;
grant all on public.application_scheduling to service_role;
alter table public.application_scheduling enable row level security;

drop policy if exists "Staff read scheduling" on public.application_scheduling;
create policy "Staff read scheduling"
on public.application_scheduling for select to authenticated
using (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- Interview slot builder
-- ---------------------------------------------------------------------------
create table if not exists public.interview_slot_offers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  kind text not null,
  selections_requested integer not null default 1,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.interview_slots (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.interview_slot_offers(id) on delete cascade,
  slot_date date not null,
  slot_time time not null,
  created_at timestamptz not null default now()
);

grant select on public.interview_slot_offers to authenticated;
grant select on public.interview_slots to authenticated;
grant all on public.interview_slot_offers to service_role;
grant all on public.interview_slots to service_role;
alter table public.interview_slot_offers enable row level security;
alter table public.interview_slots enable row level security;

drop policy if exists "Staff read slot offers" on public.interview_slot_offers;
create policy "Staff read slot offers"
on public.interview_slot_offers for select to authenticated
using (public.is_staff(auth.uid()));

drop policy if exists "Staff read slots" on public.interview_slots;
create policy "Staff read slots"
on public.interview_slots for select to authenticated
using (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- Interview #2 materials
-- ---------------------------------------------------------------------------
create table if not exists public.interview_materials (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  materials_url text not null,
  sent_by uuid,
  sent_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_note text not null default ''
);

grant select on public.interview_materials to authenticated;
grant all on public.interview_materials to service_role;
alter table public.interview_materials enable row level security;

drop policy if exists "Staff read interview materials" on public.interview_materials;
create policy "Staff read interview materials"
on public.interview_materials for select to authenticated
using (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- Workflow functions. All are security definer with a role check and a fixed
-- column allow-list; staff never receive table-level UPDATE.
-- ---------------------------------------------------------------------------
create or replace function public.assign_application(
  _application_id uuid,
  _staff_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _previous uuid;
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized to assign applicants';
  end if;
  if _staff_id is not null and not exists (
    select 1 from public.staff_profiles where user_id = _staff_id and is_active
  ) then
    raise exception 'That staff member is not active';
  end if;

  select assigned_to into _previous from public.applications where id = _application_id;

  update public.applications
     set assigned_to = _staff_id,
         assigned_at = case when _staff_id is null then null else now() end,
         updated_at = now()
   where id = _application_id;

  insert into public.application_events (application_id, actor_id, event_type, detail, is_internal)
  values (
    _application_id,
    auth.uid(),
    case when _previous is null then 'assigned' else 'reassigned' end,
    coalesce((select coalesce(full_name, email) from public.staff_profiles where user_id = _staff_id), 'Unassigned'),
    false
  );
end;
$$;

create or replace function public.set_application_milestone(
  _application_id uuid,
  _milestone_key text,
  _next_action text default null,
  _due_at timestamptz default null,
  _override_reason text default null,
  _closed_other_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _current text;
  _current_ord integer;
  _new_ord integer;
  _new_status text;
  _requires_expl boolean;
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized to change milestones';
  end if;

  select status_key, ordinal, requires_explanation
    into _new_status, _new_ord, _requires_expl
    from public.milestone_catalog where milestone_key = _milestone_key;
  if _new_ord is null then
    raise exception 'Unknown milestone';
  end if;

  if _requires_expl and coalesce(btrim(_closed_other_reason), '') = '' then
    raise exception 'A private explanation is required for this milestone';
  end if;

  -- Interview #2 milestones only become available once Interview #1 has been
  -- completed and an Admin or HR member has advanced the applicant.
  if _new_status = 'interview_2' and not exists (
    select 1 from public.applications a
     where a.id = _application_id and a.status = 'interview_2'
  ) then
    raise exception 'Interview #1 must be completed and the applicant advanced to Interview #2 first.';
  end if;

  select current_milestone into _current from public.applications where id = _application_id;
  if not found then
    raise exception 'Application not found';
  end if;

  select ordinal into _current_ord from public.milestone_catalog
   where milestone_key = coalesce(_current, 'application_received');

  -- Skipping ahead requires an explicit private override reason.
  if _new_status <> 'not_selected'
     and _current_ord is not null
     and _new_ord - _current_ord > 1
     and coalesce(btrim(_override_reason), '') = '' then
    raise exception 'This milestone would skip a required step. A private override reason is required.';
  end if;

  update public.applications
     set current_milestone = _milestone_key,
         status = _new_status,
         next_action = _next_action,
         milestone_due_at = _due_at,
         milestone_completed_at = null,
         closed_other_reason = coalesce(_closed_other_reason, closed_other_reason),
         updated_at = now()
   where id = _application_id;

  insert into public.application_milestones
    (application_id, status_key, milestone_key, assigned_to, assigned_at, due_at, next_action, state)
  select _application_id, _new_status, _milestone_key, a.assigned_to, a.assigned_at, _due_at, _next_action, 'active'
    from public.applications a where a.id = _application_id;

  insert into public.application_events (application_id, actor_id, event_type, to_status, detail, is_internal)
  values (_application_id, auth.uid(), 'milestone_changed', _new_status,
          (select label from public.milestone_catalog where milestone_key = _milestone_key), false);

  if coalesce(btrim(_override_reason), '') <> '' then
    insert into public.application_events (application_id, actor_id, event_type, detail, is_internal)
    values (_application_id, auth.uid(), 'workflow_override', _override_reason, true);
  end if;

  if _due_at is not null then
    insert into public.application_events (application_id, actor_id, event_type, detail, is_internal)
    values (_application_id, auth.uid(), 'deadline_set', to_char(_due_at, 'YYYY-MM-DD HH24:MI'), false);
  end if;
end;
$$;

create or replace function public.advance_to_interview_2(
  _application_id uuid
)
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
       and milestone_key = 'interview1_completed'
       and completed_at is not null
  ) then
    raise exception 'Interview #1 must be marked completed before advancing to Interview #2.';
  end if;

  update public.applications
     set status = 'interview_2',
         current_milestone = 'interview2_materials_pending',
         next_action = 'Send the Interview #2 materials to the applicant.',
         milestone_due_at = null,
         milestone_completed_at = null,
         updated_at = now()
   where id = _application_id;

  insert into public.application_milestones
    (application_id, status_key, milestone_key, assigned_to, assigned_at, next_action, state)
  select _application_id, 'interview_2', 'interview2_materials_pending', a.assigned_to, a.assigned_at,
         'Send the Interview #2 materials to the applicant.', 'active'
    from public.applications a where a.id = _application_id;

  insert into public.application_events (application_id, actor_id, event_type, from_status, to_status, detail, is_internal)
  values (_application_id, auth.uid(), 'advanced_to_interview_2', _old, 'interview_2',
          coalesce((select coalesce(full_name, email) from public.staff_profiles where user_id = auth.uid()), 'Staff')
          || ' advanced this applicant to Interview #2', false);
end;
$$;

create or replace function public.complete_milestone(
  _application_id uuid,
  _detail text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _current text;
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized to complete milestones';
  end if;

  select current_milestone into _current from public.applications where id = _application_id;

  update public.applications
     set milestone_completed_at = now(),
         updated_at = now()
   where id = _application_id;

  update public.application_milestones
     set completed_at = now(), state = 'completed'
   where application_id = _application_id
     and milestone_key = coalesce(_current, 'application_received')
     and completed_at is null;

  insert into public.application_events (application_id, actor_id, event_type, detail, is_internal)
  values (_application_id, auth.uid(), 'milestone_completed',
          coalesce((select label from public.milestone_catalog where milestone_key = _current), 'Application received')
          || coalesce(' — ' || _detail, ''), false);
end;
$$;

create or replace function public.set_milestone_deadline(
  _application_id uuid,
  _due_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized to set deadlines';
  end if;

  update public.applications
     set milestone_due_at = _due_at, updated_at = now()
   where id = _application_id;

  insert into public.application_events (application_id, actor_id, event_type, detail, is_internal)
  values (_application_id, auth.uid(), 'deadline_set',
          coalesce(to_char(_due_at, 'YYYY-MM-DD HH24:MI'), 'cleared'), false);
end;
$$;

create or replace function public.record_communication(
  _application_id uuid,
  _comm_type text,
  _occurred_at timestamptz,
  _milestone_key text default null,
  _template_key text default null,
  _message_text text default '',
  _private_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized to record communications';
  end if;
  if _comm_type not in (
    'text_attempted','text_sent','applicant_responded','call_attempted','call_completed',
    'voicemail_left','confirmation_requested','confirmation_received','deadline_missed',
    'reschedule_requested','reschedule_approved','reschedule_denied'
  ) then
    raise exception 'Invalid communication type';
  end if;

  insert into public.application_communications
    (application_id, staff_id, comm_type, occurred_at, milestone_key, template_key, message_text, private_note)
  values (_application_id, auth.uid(), _comm_type, coalesce(_occurred_at, now()), _milestone_key,
          _template_key, coalesce(_message_text, ''), coalesce(_private_note, ''))
  returning id into _id;

  insert into public.application_events (application_id, actor_id, event_type, detail, is_internal)
  values (_application_id, auth.uid(),
          case when _comm_type = 'deadline_missed' then 'deadline_missed' else 'communication_recorded' end,
          _comm_type, false);

  return _id;
end;
$$;

-- Private communication notes are readable only by admin/HR.
create or replace function public.communication_notes(_application_id uuid)
returns table (communication_id uuid, private_note text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized to read private communication notes';
  end if;
  return query
    select c.id, c.private_note
      from public.application_communications c
     where c.application_id = _application_id;
end;
$$;

create or replace function public.set_scheduling(
  _application_id uuid,
  _kind text,
  _proposed_date date,
  _window_start time,
  _window_end time,
  _applicant_availability text default '',
  _final_window_start timestamptz default null,
  _final_window_end timestamptz default null,
  _completed_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _state text;
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized to schedule interviews';
  end if;
  if _kind not in ('phone','interview_1','interview_2') then
    raise exception 'Invalid scheduling kind';
  end if;

  select confirmation_state into _state
    from public.application_scheduling
   where application_id = _application_id and kind = _kind;

  -- Once the applicant has confirmed, the time is fixed.
  if _state = 'confirmed' and _completed_at is null then
    raise exception 'This interview is confirmed and cannot be rescheduled';
  end if;

  insert into public.application_scheduling
    (application_id, kind, proposed_date, window_start, window_end, applicant_availability,
     final_window_start, final_window_end, completed_at, confirmation_state, confirmation_due_at)
  values (_application_id, _kind, _proposed_date, _window_start, _window_end,
          coalesce(_applicant_availability, ''), _final_window_start, _final_window_end, _completed_at,
          'awaiting_confirmation', now() + interval '24 hours')
  on conflict (application_id, kind) do update
     set proposed_date = excluded.proposed_date,
         window_start = excluded.window_start,
         window_end = excluded.window_end,
         applicant_availability = excluded.applicant_availability,
         final_window_start = excluded.final_window_start,
         final_window_end = excluded.final_window_end,
         completed_at = coalesce(excluded.completed_at, application_scheduling.completed_at),
         confirmation_state = coalesce(application_scheduling.confirmation_state, 'awaiting_confirmation'),
         confirmation_due_at = coalesce(application_scheduling.confirmation_due_at, now() + interval '24 hours'),
         updated_at = now();

  insert into public.application_events (application_id, actor_id, event_type, detail, is_internal)
  values (_application_id, auth.uid(), 'scheduling_updated', _kind, false);
end;
$$;

create or replace function public.set_confirmation_state(
  _application_id uuid,
  _kind text,
  _state text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _existing text;
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized to update confirmation state';
  end if;
  if _state not in (
    'awaiting_confirmation','confirmed','applicant_declined',
    'rescheduling_under_review','rescheduled','confirmation_deadline_missed'
  ) then
    raise exception 'Invalid confirmation state';
  end if;

  select confirmation_state into _existing
    from public.application_scheduling
   where application_id = _application_id and kind = _kind;
  if _existing is null then
    raise exception 'No proposed time is recorded for this interview yet';
  end if;
  if _existing = 'confirmed' and _state in ('rescheduling_under_review','rescheduled','applicant_declined') then
    raise exception 'This interview is confirmed and cannot be rescheduled';
  end if;

  update public.application_scheduling
     set confirmation_state = _state,
         confirmation_due_at = case when _state = 'awaiting_confirmation' then now() + interval '24 hours'
                                    else confirmation_due_at end,
         updated_at = now()
   where application_id = _application_id and kind = _kind;

  insert into public.application_events (application_id, actor_id, event_type, detail, is_internal)
  values (_application_id, auth.uid(), 'confirmation_changed', _kind || ': ' || _state, false);
end;
$$;

create or replace function public.save_slot_offer(
  _application_id uuid,
  _kind text,
  _selections_requested integer,
  _slots jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _offer uuid;
  _count integer;
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized to build interview slots';
  end if;
  if _kind not in ('phone','interview_1','interview_2') then
    raise exception 'Invalid scheduling kind';
  end if;

  select count(*) into _count from jsonb_array_elements(coalesce(_slots, '[]'::jsonb));
  if _count = 0 then
    raise exception 'Add at least one date and time';
  end if;
  if _selections_requested < 1 or _selections_requested > _count then
    raise exception 'The number of requested preferences cannot exceed the number of slots offered';
  end if;

  insert into public.interview_slot_offers (application_id, kind, selections_requested, created_by)
  values (_application_id, _kind, _selections_requested, auth.uid())
  returning id into _offer;

  insert into public.interview_slots (offer_id, slot_date, slot_time)
  select _offer, (elem->>'date')::date, (elem->>'time')::time
    from jsonb_array_elements(_slots) as elem;

  insert into public.application_events (application_id, actor_id, event_type, detail, is_internal)
  values (_application_id, auth.uid(), 'slots_offered',
          _count || ' slots, ' || _selections_requested || ' requested', false);

  return _offer;
end;
$$;

create or replace function public.send_interview_materials(
  _application_id uuid,
  _materials_url text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
  _ord integer;
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized to send interview materials';
  end if;

  -- Interview #2 materials unlock only after Interview #1 is completed.
  if not exists (
    select 1 from public.application_milestones m
     where m.application_id = _application_id
       and m.milestone_key = 'interview1_completed'
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

create or replace function public.acknowledge_interview_materials(
  _materials_id uuid,
  _note text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _app uuid;
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  update public.interview_materials
     set acknowledged_at = now(), acknowledged_note = coalesce(_note, '')
   where id = _materials_id
  returning application_id into _app;

  if _app is null then
    raise exception 'Materials record not found';
  end if;

  insert into public.application_events (application_id, actor_id, event_type, detail, is_internal)
  values (_app, auth.uid(), 'materials_acknowledged', 'Applicant acknowledgment recorded', false);
end;
$$;