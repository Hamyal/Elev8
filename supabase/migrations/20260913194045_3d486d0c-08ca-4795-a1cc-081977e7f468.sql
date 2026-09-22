create or replace function public.reopen_application(
  _application_id uuid,
  _reason text,
  _milestone_key text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _status text;
  _target text;
  _target_status text;
  _target_label text;
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized to reopen applications';
  end if;

  if coalesce(btrim(_reason), '') = '' or length(btrim(_reason)) < 5 then
    raise exception 'A private reason is required to reopen this application';
  end if;

  select status into _status from public.applications where id = _application_id;
  if not found then
    raise exception 'Application not found';
  end if;
  if _status <> 'not_selected' then
    raise exception 'This application is not closed.';
  end if;

  _target := _milestone_key;

  if _target is null then
    select m.milestone_key into _target
      from public.application_milestones m
      join public.milestone_catalog c on c.milestone_key = m.milestone_key
     where m.application_id = _application_id
       and c.status_key <> 'not_selected'
       and c.ordinal < 900
     order by m.created_at desc
     limit 1;
  end if;

  _target := coalesce(_target, 'application_received');

  select status_key, label into _target_status, _target_label
    from public.milestone_catalog
   where milestone_key = _target and ordinal < 900 and status_key <> 'not_selected';
  if _target_status is null then
    raise exception 'That step cannot be reopened to.';
  end if;

  update public.application_milestones
     set state = 'reopened'
   where application_id = _application_id
     and state = 'active';

  update public.applications
     set status = _target_status,
         current_milestone = _target,
         milestone_completed_at = null,
         next_action = 'Application reopened — review the record and continue this step.',
         updated_at = now()
   where id = _application_id;

  insert into public.application_milestones
    (application_id, status_key, milestone_key, assigned_to, assigned_at, next_action, state)
  select _application_id, _target_status, _target, a.assigned_to, a.assigned_at,
         'Application reopened — review the record and continue this step.', 'active'
    from public.applications a where a.id = _application_id;

  insert into public.application_events (application_id, actor_id, event_type, to_status, detail, is_internal)
  values (_application_id, auth.uid(), 'application_reopened', _target_status,
          'Application reopened and returned to "' || _target_label || '".', false);

  insert into public.application_events (application_id, actor_id, event_type, detail, is_internal)
  values (_application_id, auth.uid(), 'reopen_reason', btrim(_reason), true);

  return _target;
end;
$$;

grant execute on function public.reopen_application(uuid, text, text) to authenticated;