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
  _actor text;
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

  select status into _old_status from public.applications where id = _application_id;
  if not found then
    raise exception 'Application not found';
  end if;

  select coalesce(full_name, email) into _actor
    from public.staff_profiles where user_id = auth.uid();

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

  insert into public.application_events (application_id, actor_id, event_type, detail, is_internal)
  values (_application_id, auth.uid(), 'workflow_override', btrim(_reason), true);
end;
$$;