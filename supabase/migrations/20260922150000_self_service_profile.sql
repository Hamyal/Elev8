-- Lets a signed-in person correct their own name.
--
-- "Update their own required information" applies to every role, but the only
-- write policy on staff_profiles is admin-only, so today nobody can change
-- their own details — not even an Admin, who is excluded from their own row by
-- the guards on user_roles.
--
-- A policy cannot restrict which columns are written, and this needs to: a
-- person may fix their display name, but must not be able to reactivate a
-- disabled account, move their record to someone else's user_id, or change the
-- email their sign-in is keyed on. So it goes through a function with a fixed
-- column list, the same pattern the applicant workflow already uses.

CREATE OR REPLACE FUNCTION public.update_own_profile(_full_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if coalesce(btrim(_full_name), '') = '' then
    raise exception 'Enter your full name';
  end if;

  if length(btrim(_full_name)) > 200 then
    raise exception 'That name is too long';
  end if;

  update public.staff_profiles
     set full_name = btrim(_full_name)
   where user_id = auth.uid();

  if not found then
    raise exception 'No profile exists for this account';
  end if;
end;
$$;

GRANT EXECUTE ON FUNCTION public.update_own_profile(text) TO authenticated;

-- Everything a signed-in person may see about themselves, in one call.
-- Readable by any role, and it exposes only the caller's own row.
CREATE OR REPLACE FUNCTION public.my_account()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  is_active boolean,
  roles text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select sp.user_id,
         sp.full_name,
         sp.email,
         sp.is_active,
         coalesce(array_agg(ur.role::text order by ur.role) filter (where ur.role is not null), '{}')
    from public.staff_profiles sp
    left join public.user_roles ur on ur.user_id = sp.user_id
   where sp.user_id = auth.uid()
   group by sp.user_id, sp.full_name, sp.email, sp.is_active;
$$;

GRANT EXECUTE ON FUNCTION public.my_account() TO authenticated;
