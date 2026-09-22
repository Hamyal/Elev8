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
  _current_status text;
  _current_label text;
  _current_pos int;
  _next_label text;
  _next_status text;
  _next_pos int;
  _assigned uuid;
  _previous uuid;
  _actor_name text;
  _staff_name text;
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

  select c.label, c.status_key,
         (select count(*) from public.milestone_catalog x
           where x.ordinal < 900 and x.ordinal < c.ordinal)
    into _current_label, _current_status, _current_pos
    from public.milestone_catalog c
   where c.milestone_key = _current;

  select c.label, c.status_key,
         (select count(*) from public.milestone_catalog x
           where x.ordinal < 900 and x.ordinal < c.ordinal)
    into _next_label, _next_status, _next_pos
    from public.milestone_catalog c
   where c.milestone_key = _next_milestone_key
     and c.ordinal < 900;

  if _next_label is null then
    raise exception 'Unknown next milestone: %', _next_milestone_key;
  end if;

  if _next_status <> 'not_selected'
     and _current_pos is not null
     and _next_pos - _current_pos > 1
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
     set state = 'completed',
         completed_at = now()
   where application_id = _application_id
     and milestone_key = _current
     and state = 'active';

  _assigned := coalesce(_staff_id, _previous);

  update public.applications
     set status = _next_status,
         current_milestone = _next_milestone_key,
         next_action = _next_action,
         assigned_to = _assigned,
         assigned_at = case when _assigned is not null and _assigned is distinct from _previous
                            then now() else assigned_at end,
         milestone_due_at = _due_at,
         milestone_completed_at = null,
         updated_at = now()
   where id = _application_id;

  insert into public.application_milestones
    (application_id, status_key, milestone_key, assigned_to, assigned_at, next_action, due_at, state)
  values (_application_id, _next_status, _next_milestone_key, _assigned,
          case when _assigned is not null then now() else null end,
          _next_action, _due_at, 'active');

  _staff_name := case when _assigned is not null
                      then coalesce((select coalesce(full_name, email)
                                       from public.staff_profiles where user_id = _assigned), 'Staff')
                      else null end;

  insert into public.application_events
    (application_id, actor_id, event_type, from_status, to_status, detail, is_internal)
  values (
    _application_id,
    auth.uid(),
    'milestone_advanced',
    _current_status,
    _next_status,
    _actor_name
    || ' completed "' || coalesce(_current_label, _current) || '" and started "' || _next_label || '".'
    || coalesce(' Next: ' || _next_action || '.', '')
    || case when _staff_name is not null then ' Assigned to ' || _staff_name || '.' else '' end
    || case when _due_at is not null
            then ' Due ' || to_char(_due_at at time zone 'America/Los_Angeles', 'Mon DD, YYYY FMHH12:MI AM') || '.'
            else '' end
    || case when coalesce(btrim(_detail), '') <> '' then ' Note: ' || btrim(_detail) else '' end,
    false
  );
end;
$$;