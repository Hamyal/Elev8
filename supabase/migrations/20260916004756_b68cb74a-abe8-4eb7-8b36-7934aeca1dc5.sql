-- Shared helper: record every step between _from_ord (inclusive) and _to_ord
-- (exclusive) as completed, tagged "Manually Jumped".
create or replace function public.record_skipped_milestones(
  _application_id uuid, _from_ord integer, _to_ord integer
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _n integer := 0;
begin
  if _from_ord is null or _to_ord is null or _to_ord <= _from_ord then
    return 0;
  end if;

  with catalogue as (
    select mc.milestone_key, mc.status_key
      from public.milestone_catalog mc
     where mc.ordinal >= _from_ord
       and mc.ordinal < _to_ord
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

  get diagnostics _n = row_count;

  update public.application_milestones am
     set completed_at = now(), state = 'completed',
         next_action = 'Manually Jumped'
   where am.application_id = _application_id
     and am.completed_at is null
     and exists (
       select 1 from public.milestone_catalog mc
        where mc.milestone_key = am.milestone_key
          and mc.ordinal >= _from_ord
          and mc.ordinal < _to_ord
          and mc.status_key <> 'not_selected'
     );

  return _n;
end;
$$;

revoke all on function public.record_skipped_milestones(uuid, integer, integer) from public, anon;

-- Jump to step now delegates to the helper (same behaviour, one implementation).
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

  _skipped := public.record_skipped_milestones(_application_id, _current_ord, _new_ord);

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

-- Setting a milestone directly (staff skipping a record ahead) records the
-- steps it skips as well, closing the same gap.
create or replace function public.set_application_milestone(
  _application_id uuid,
  _milestone_key text,
  _next_action text default null,
  _due_at timestamptz default null,
  _override_reason text default null,
  _closed_other_reason text default null
) returns void
language plpgsql
security definer
set search_path to 'public'
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

  if _new_status <> 'not_selected'
     and _current_ord is not null
     and _new_ord - _current_ord > 1
     and coalesce(btrim(_override_reason), '') = '' then
    raise exception 'This milestone would skip a required step. A private override reason is required.';
  end if;

  if _new_status <> 'not_selected' then
    perform public.record_skipped_milestones(_application_id, _current_ord, _new_ord);
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
    values (_application_id, auth.uid(), 'deadline_set', to_char(_due_at, 'YYYY-MM-DD HH24:MI'), true);
  end if;
end;
$$;

revoke all on function public.set_application_milestone(uuid, text, text, timestamptz, text, text) from public, anon;
grant execute on function public.set_application_milestone(uuid, text, text, timestamptz, text, text) to authenticated, service_role;

-- One-time repair: every open record whose earlier steps appear completed on
-- screen but have no completion recorded gets those completions backfilled.
do $$
declare
  _rec record;
  _ord integer;
begin
  for _rec in
    select a.id, a.current_milestone
      from public.applications a
     where a.status <> 'not_selected'
  loop
    select ordinal into _ord from public.milestone_catalog
     where milestone_key = coalesce(_rec.current_milestone, 'application_received');
    if _ord is not null then
      perform public.record_skipped_milestones(_rec.id, 1, _ord);
    end if;
  end loop;
end;
$$;