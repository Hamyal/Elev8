create or replace function public.jump_to_milestone(_application_id uuid, _milestone_key text, _reason text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _new_ord integer;
  _new_status text;
  _requires_expl boolean;
  _label text;
  _old_status text;
  _current text;
  _current_ord integer;
  _actor text;
  _skipped integer := 0;
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized to change milestones';
  end if;

  if coalesce(btrim(_reason), '') = '' then
    raise exception 'A short private reason is required to move this record.';
  end if;

  select status_key, ordinal, requires_explanation, label
    into _new_status, _new_ord, _requires_expl, _label
    from public.milestone_catalog where milestone_key = _milestone_key;
  if _new_ord is null then
    raise exception 'Unknown milestone';
  end if;

  select status, current_milestone into _old_status, _current
    from public.applications where id = _application_id;
  if not found then
    raise exception 'Application not found';
  end if;

  select ordinal into _current_ord from public.milestone_catalog
   where milestone_key = coalesce(_current, 'application_received');

  select coalesce(full_name, email) into _actor
    from public.staff_profiles where user_id = auth.uid();

  -- Moving forward: every step between the record's previous position and the
  -- target (inclusive of the previous position) is recorded as completed so
  -- later gates such as advance_to_interview_2 find what they expect. Rows
  -- created this way are tagged "Manually Jumped" so history stays honest.
  if _current_ord is not null and _new_ord > _current_ord then
    with catalogue as (
      select mc.milestone_key, mc.status_key
        from public.milestone_catalog mc
       where mc.ordinal >= _current_ord
         and mc.ordinal < _new_ord
         and mc.status_key <> 'not_selected'
    ), missing as (
      select c.milestone_key, c.status_key
        from catalogue c
       where not exists (
         select 1 from public.application_milestones am
          where am.application_id = _application_id
            and am.milestone_key = c.milestone_key
            and am.completed_at is not null
       )
    )
    insert into public.application_milestones
      (application_id, status_key, milestone_key, assigned_to, assigned_at,
       completed_at, state, next_action)
    select _application_id, m.status_key, m.milestone_key, a.assigned_to, a.assigned_at,
           now(), 'completed', 'Manually Jumped'
      from missing m
      cross join public.applications a
     where a.id = _application_id;

    get diagnostics _skipped = row_count;

    -- Any still-open rows for those steps are closed out with the same tag.
    update public.application_milestones am
       set completed_at = now(), state = 'completed',
           next_action = 'Manually Jumped'
     where am.application_id = _application_id
       and am.completed_at is null
       and exists (
         select 1 from public.milestone_catalog mc
          where mc.milestone_key = am.milestone_key
            and mc.ordinal >= _current_ord
            and mc.ordinal < _new_ord
            and mc.status_key <> 'not_selected'
       );
  end if;

  update public.applications
     set current_milestone = _milestone_key,
         status = _new_status,
         next_action = null,
         milestone_due_at = null,
         milestone_completed_at = null,
         closed_other_reason = case when _requires_expl then _reason else closed_other_reason end,
         updated_at = now()
   where id = _application_id;

  insert into public.application_milestones
    (application_id, status_key, milestone_key, assigned_to, assigned_at, state)
  select _application_id, _new_status, _milestone_key, a.assigned_to, a.assigned_at, 'active'
    from public.applications a where a.id = _application_id;

  insert into public.application_events
    (application_id, actor_id, event_type, from_status, to_status, detail, is_internal)
  values (_application_id, auth.uid(), 'milestone_jumped', _old_status, _new_status,
          'Manually moved to ' || _label || ' by ' || coalesce(_actor, 'Staff') || ' — ' || btrim(_reason),
          false);

  if _skipped > 0 then
    insert into public.application_events (application_id, actor_id, event_type, detail, is_internal)
    values (_application_id, auth.uid(), 'workflow_override',
            _skipped || ' skipped step(s) recorded as completed and tagged "Manually Jumped".', true);
  end if;

  insert into public.application_events (application_id, actor_id, event_type, detail, is_internal)
  values (_application_id, auth.uid(), 'workflow_override', btrim(_reason), true);
end;
$$;

revoke all on function public.jump_to_milestone(uuid, text, text) from public, anon;
grant execute on function public.jump_to_milestone(uuid, text, text) to authenticated, service_role;