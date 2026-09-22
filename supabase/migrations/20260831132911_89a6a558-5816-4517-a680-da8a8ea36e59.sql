-- Staff-only helper functions must never be callable by unauthenticated
-- visitors. Each function already verifies the caller's role internally, so
-- signed-in execution stays, but public/anon EXECUTE is revoked.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'has_role','is_staff','can_review','set_application_status','set_hr_flag_review',
        'hr_flag_notes','record_file_access','add_application_note','assign_application',
        'set_application_milestone','advance_to_interview_2','complete_milestone',
        'set_milestone_deadline','record_communication','communication_notes','set_scheduling',
        'set_confirmation_state','save_slot_offer','send_interview_materials',
        'acknowledge_interview_materials'
      )
  loop
    execute format('revoke all on function %s from public, anon', fn.sig);
    execute format('grant execute on function %s to authenticated, service_role', fn.sig);
  end loop;
end $$;