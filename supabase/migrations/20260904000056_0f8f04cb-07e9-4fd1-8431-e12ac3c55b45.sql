create or replace function public.complete_and_advance_milestone(
  _application_id uuid,
  _next_milestone_key text,
  _next_action text default null,
  _due_at timestamptz default null,
  _staff_id uuid default null,
  _detail text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _current text;
  _current_label text;
  _current_status text;
  _next_label text;
  _next_status text;
  _next_ord integer;
  _current_ord integer;
  _previous uuid;
  _actor_name text;
  _assignee_name text;
  _event_detail text;
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized to advance applicants';
  end if;

  select a.current_milestone, a.status, a.assigned_to
    into _current, _current_status, _previous
    from public.applications a
   where a.id = _application_id;

  if _current is null then
    _current := 'application_received';
  end if;

  select label, status_key, ordinal
    into _current_label, _current_status, _current_ord
    from public.milestone_catalog
   where milestone_key = _current;

  select label, status_key, ordinal
    into _next_label, _next_status, _next_ord
    from public.milestone_catalog
   where milestone_key = _next_milestone_key;

  if _next_label is null then
    raise exception 'Unknown next milestone: %', _next_milestone_key;
  end if;

  if _next_status <> 'not_selected'
     and _current_ord is not null
     and _next_ord - _current_ord > 1
     and coalesce(btrim(_detail), '') = '' then
    raise exception 'This milestone would skip a required step. A private override reason is required.';
  end if;

  if _staff_id is not null and not exists (
    select 1 from public.staff_profiles where user_id = _staff_id and is_active
  ) then
    raise exception 'That staff member is not active';
  end if;

  _actor_name := coalesce(
    (select coalesce(full_name, email) from public.staff_profiles where user_id = auth.uid()),
    'Staff'
  );

  update public.applications
     set milestone_completed_at = now(),
         updated_at = now()
   where id = _application_id;

  update public.application_milestones
     set completed_at = now(), state = 'completed'
   where application_id = _application_id
     and milestone_key = _current
     and completed_at is null;

  if _staff_id is distinct from _previous then
    update public.applications
       set assigned_to = _staff_id,
           assigned_at = case when _staff_id is null then null else now() end,
           updated_at = now()
     where id = _application_id;
  end if;

  update public.applications
     set current_milestone = _next_milestone_key,
         status = _next_status,
         next_action = _next_action,
         milestone_due_at = _due_at,
         milestone_completed_at = null,
         updated_at = now()
   where id = _application_id;

  insert into public.application_milestones
    (application_id, status_key, milestone_key, assigned_to, assigned_at, due_at, next_action, state)
  select _application_id, _next_status, _next_milestone_key, a.assigned_to, a.assigned_at, _due_at, _next_action, 'active'
    from public.applications a where a.id = _application_id;

  _event_detail := coalesce(_current_label, 'Application received') || ' completed by ' || _actor_name;
  _event_detail := _event_detail || ' on ' || to_char(now(), 'Month DD, YYYY at HH12:MI AM');
  _event_detail := _event_detail || '. Next step: ' || _next_label || '.';

  if _staff_id is not null then
    _assignee_name := coalesce(
      (select coalesce(full_name, email) from public.staff_profiles where user_id = _staff_id),
      'Staff'
    );
    _event_detail := _event_detail || ' Assigned to ' || _assignee_name || '.';
  end if;

  if _due_at is not null then
    _event_detail := _event_detail || ' Due ' || to_char(_due_at, 'Month DD, YYYY at HH12:MI AM') || '.';
  end if;

  insert into public.application_events
    (application_id, actor_id, event_type, from_status, to_status, detail, is_internal)
  values
    (_application_id, auth.uid(), 'milestone_advanced', _current_status, _next_status, _event_detail, false);

  if coalesce(btrim(_detail), '') <> '' and _next_ord - _current_ord > 1 then
    insert into public.application_events (application_id, actor_id, event_type, detail, is_internal)
    values (_application_id, auth.uid(), 'workflow_override', _detail, true);
  end if;
end;
$$;

revoke all on function public.complete_and_advance_milestone(uuid, text, text, timestamptz, uuid, text) from public, anon;
grant execute on function public.complete_and_advance_milestone(uuid, text, text, timestamptz, uuid, text) to authenticated, service_role;
