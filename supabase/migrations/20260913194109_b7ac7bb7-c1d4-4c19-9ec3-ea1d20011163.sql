revoke execute on function public.reopen_application(uuid, text, text) from public;
revoke execute on function public.reopen_application(uuid, text, text) from anon;
grant execute on function public.reopen_application(uuid, text, text) to authenticated;