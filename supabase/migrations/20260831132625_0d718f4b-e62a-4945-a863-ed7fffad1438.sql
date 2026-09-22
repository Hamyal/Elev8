-- ATS Phase 1 — Secure Applicant Review
-- Additive only: no existing table, column, row, policy, or storage object is
-- dropped, renamed, retyped, or migrated. Applicant intake keeps its existing
-- public INSERT policies untouched.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'hr', 'viewer');
  end if;
end $$;

create table if not exists public.staff_profiles (
  user_id uuid primary key,
  full_name text not null default '',
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

grant select, insert, update on public.staff_profiles to authenticated;
grant all on public.staff_profiles to service_role;
alter table public.staff_profiles enable row level security;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- Authorization helper. security definer + fixed search_path so policies never
-- need to read other people's role rows and the path cannot be hijacked.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.staff_profiles sp on sp.user_id = ur.user_id
    where ur.user_id = _user_id
      and ur.role = _role
      and sp.is_active
  )
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.staff_profiles sp on sp.user_id = ur.user_id
    where ur.user_id = _user_id and sp.is_active
  )
$$;

create or replace function public.can_review(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(_user_id, 'admin') or public.has_role(_user_id, 'hr')
$$;

-- Staff read their own role only; admins read all.
drop policy if exists "Own role assignment is readable" on public.user_roles;
create policy "Own role assignment is readable"
on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Admins manage roles, never their own row (no self-elevation).
drop policy if exists "Admins assign roles to others" on public.user_roles;
create policy "Admins assign roles to others"
on public.user_roles for insert to authenticated
with check (public.has_role(auth.uid(), 'admin') and user_id <> auth.uid());

drop policy if exists "Admins update roles of others" on public.user_roles;
create policy "Admins update roles of others"
on public.user_roles for update to authenticated
using (public.has_role(auth.uid(), 'admin') and user_id <> auth.uid())
with check (public.has_role(auth.uid(), 'admin') and user_id <> auth.uid());

drop policy if exists "Admins remove roles of others" on public.user_roles;
create policy "Admins remove roles of others"
on public.user_roles for delete to authenticated
using (public.has_role(auth.uid(), 'admin') and user_id <> auth.uid());

drop policy if exists "Staff read own profile" on public.staff_profiles;
create policy "Staff read own profile"
on public.staff_profiles for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins manage staff profiles" on public.staff_profiles;
create policy "Admins manage staff profiles"
on public.staff_profiles for insert to authenticated
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins update staff profiles" on public.staff_profiles;
create policy "Admins update staff profiles"
on public.staff_profiles for update to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- Applications: staff read access only. No table-level UPDATE for staff.
-- ---------------------------------------------------------------------------
-- Stable lowercase status values. 'submitted' is the historic intake default
-- and is displayed as "New"; it is kept so existing rows stay valid.
alter table public.applications
  add constraint applications_status_allowed
  check (status in (
    'submitted','new','screening','interview_1','interview_2','offer','hired','not_selected'
  )) not valid;

grant select on public.applications to authenticated;
grant select on public.hr_review_flags to authenticated;

drop policy if exists "Staff can read applications" on public.applications;
create policy "Staff can read applications"
on public.applications for select to authenticated
using (public.is_staff(auth.uid()));

-- Status changes are only possible through this function, which writes
-- status + updated_at and nothing else.
create or replace function public.set_application_status(
  _application_id uuid,
  _new_status text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _old text;
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized to change application status';
  end if;
  if _new_status not in ('new','screening','interview_1','interview_2','offer','hired','not_selected') then
    raise exception 'Invalid status';
  end if;

  -- Interview #2 is never entered by editing the status. It requires the
  -- explicit "Advance to Interview #2" decision, which is recorded separately.
  if _new_status = 'interview_2' then
    raise exception 'Use Advance to Interview #2 to move an applicant into that stage.';
  end if;

  select status into _old from public.applications where id = _application_id;
  if _old is null then
    raise exception 'Application not found';
  end if;

  update public.applications
     set status = _new_status,
         updated_at = now()
   where id = _application_id;

  insert into public.application_events (application_id, actor_id, event_type, from_status, to_status, is_internal)
  values (_application_id, auth.uid(), 'status_changed', _old, _new_status, false);

  return _old;
end;
$$;

-- ---------------------------------------------------------------------------
-- HR review flags: original data is immutable; only triage fields change.
-- ---------------------------------------------------------------------------
alter table public.hr_review_flags
  add column if not exists flag_status text not null default 'Needs Review',
  add column if not exists hr_notes text not null default '';

-- Column-level read permission: hr_notes is never selectable by staff clients.
revoke select on public.hr_review_flags from authenticated;
grant select (id, application_id, question, answer, created_at, flag_status)
  on public.hr_review_flags to authenticated;

drop policy if exists "Staff can read hr review flags" on public.hr_review_flags;
create policy "Staff can read hr review flags"
on public.hr_review_flags for select to authenticated
using (public.is_staff(auth.uid()));

create or replace function public.guard_hr_flag_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.application_id <> old.application_id
     or new.question <> old.question
     or new.answer <> old.answer
     or new.created_at <> old.created_at then
    raise exception 'Original HR flag data cannot be modified';
  end if;
  return new;
end;
$$;

drop trigger if exists hr_review_flags_immutable on public.hr_review_flags;
create trigger hr_review_flags_immutable
before update on public.hr_review_flags
for each row execute function public.guard_hr_flag_immutable();

create or replace function public.set_hr_flag_review(
  _flag_id uuid,
  _flag_status text,
  _hr_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _app uuid;
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized to update HR review flags';
  end if;
  if _flag_status not in ('Needs Review','Discussed','Resolved') then
    raise exception 'Invalid flag status';
  end if;

  update public.hr_review_flags
     set flag_status = _flag_status,
         hr_notes = coalesce(_hr_notes, '')
   where id = _flag_id
  returning application_id into _app;

  if _app is null then
    raise exception 'HR review flag not found';
  end if;

  insert into public.application_events (application_id, actor_id, event_type, detail, is_internal)
  values (_app, auth.uid(), 'flag_updated', 'Flag set to ' || _flag_status, true);
end;
$$;

-- Private HR notes are readable only through this admin/HR-gated function.
create or replace function public.hr_flag_notes(_application_id uuid)
returns table (flag_id uuid, hr_notes text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized to read private HR notes';
  end if;
  return query
    select f.id, f.hr_notes
    from public.hr_review_flags f
    where f.application_id = _application_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Private staff notes (append-only) and activity history
-- ---------------------------------------------------------------------------
create table if not exists public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  author_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);

grant select, insert on public.application_notes to authenticated;
grant all on public.application_notes to service_role;
alter table public.application_notes enable row level security;

drop policy if exists "Admin and HR read private notes" on public.application_notes;
create policy "Admin and HR read private notes"
on public.application_notes for select to authenticated
using (public.can_review(auth.uid()));

drop policy if exists "Admin and HR add private notes" on public.application_notes;
create policy "Admin and HR add private notes"
on public.application_notes for insert to authenticated
with check (public.can_review(auth.uid()) and author_id = auth.uid());

create table if not exists public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  actor_id uuid,
  event_type text not null,
  from_status text,
  to_status text,
  detail text,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

grant select, insert on public.application_events to authenticated;
grant all on public.application_events to service_role;
alter table public.application_events enable row level security;

drop policy if exists "Staff read activity history" on public.application_events;
create policy "Staff read activity history"
on public.application_events for select to authenticated
using (
  public.can_review(auth.uid())
  or (public.is_staff(auth.uid()) and is_internal = false)
);

drop policy if exists "Admin and HR write activity history" on public.application_events;
create policy "Admin and HR write activity history"
on public.application_events for insert to authenticated
with check (public.can_review(auth.uid()) and actor_id = auth.uid());

create index if not exists application_notes_application_id_idx
  on public.application_notes (application_id, created_at desc);
create index if not exists application_events_application_id_idx
  on public.application_events (application_id, created_at desc);
create index if not exists hr_review_flags_application_id_idx
  on public.hr_review_flags (application_id);

-- File-access audit entry: records what was opened, never the signed URL.
create or replace function public.record_file_access(
  _application_id uuid,
  _file_category text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff(auth.uid()) then
    raise exception 'Not authorized';
  end if;
  insert into public.application_events (application_id, actor_id, event_type, detail, is_internal)
  values (_application_id, auth.uid(), 'file_accessed', _file_category, false);
end;
$$;

create or replace function public.add_application_note(
  _application_id uuid,
  _body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
begin
  if not public.can_review(auth.uid()) then
    raise exception 'Not authorized to add notes';
  end if;
  if coalesce(btrim(_body), '') = '' then
    raise exception 'Note cannot be empty';
  end if;

  insert into public.application_notes (application_id, author_id, body)
  values (_application_id, auth.uid(), _body)
  returning id into _id;

  insert into public.application_events (application_id, actor_id, event_type, detail, is_internal)
  values (_application_id, auth.uid(), 'note_added', 'Private note added', true);

  return _id;
end;
$$;