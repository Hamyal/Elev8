-- Keeps applicant data inside the hiring team.
--
-- is_staff() previously returned true for ANY active account holding ANY role.
-- Twelve row-level-security policies are written against it, and between them
-- they grant read access to applications, notes, communications, scheduling,
-- events and HR review flags — that is, every applicant's name, phone number,
-- answers and private review notes.
--
-- With only Admin, HR and Viewer in existence that was correct: all three are
-- hiring roles. Adding Employee and Caretaker breaks that assumption. Those are
-- operational roles — care staff and general employees — and giving a caretaker
-- an account would otherwise hand them the entire applicant database.
--
-- So is_staff() now means "may use the applicant tracking system", which is the
-- meaning all twelve policies already relied on. Admin, HR and Viewer are
-- unaffected; Employee and Caretaker get an account and a profile but no
-- applicant data.
--
-- Widening access later is a deliberate act: add the role to the list below.

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1
    from public.user_roles ur
    join public.staff_profiles sp on sp.user_id = ur.user_id
    where ur.user_id = _user_id
      and sp.is_active
      -- Hiring roles only. Employee and Caretaker are deliberately absent.
      and ur.role in ('admin', 'hr', 'viewer')
  );
$$;

COMMENT ON FUNCTION public.is_staff(uuid) IS
  'True when the account may use the applicant tracking system. Hiring roles only (admin, hr, viewer) — see migration 20260922140100.';

-- Directory membership, independent of applicant access. Use this where the
-- question is "does this person have an account with us?" rather than "may
-- this person see applicants?".
CREATE OR REPLACE FUNCTION public.is_active_account(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1
    from public.user_roles ur
    join public.staff_profiles sp on sp.user_id = ur.user_id
    where ur.user_id = _user_id and sp.is_active
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_active_account(uuid) TO authenticated, service_role;
