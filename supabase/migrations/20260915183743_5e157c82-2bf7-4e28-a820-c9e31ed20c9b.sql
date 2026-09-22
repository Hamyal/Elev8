-- Insert the Advancement call step at ordinal 14, shifting later steps up by one.
update public.milestone_catalog
   set ordinal = ordinal + 1
 where ordinal >= 14;

insert into public.milestone_catalog
  (milestone_key, status_key, ordinal, label, requires_explanation, awaiting_applicant)
values
  ('i1_advancement_call', 'interview_1', 14, 'Advancement call', false, false)
on conflict (milestone_key) do update
  set status_key = excluded.status_key,
      ordinal = excluded.ordinal,
      label = excluded.label;