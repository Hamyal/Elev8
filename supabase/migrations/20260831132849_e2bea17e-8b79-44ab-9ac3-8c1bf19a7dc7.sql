-- First real Team Portal administrator: director@withelev8.com
-- Additive and idempotent. Creates no auth user (the invitation does that) and
-- changes nothing about the public application or existing rows.

insert into public.staff_profiles (user_id, full_name, email, is_active)
select u.id, 'Director', u.email, true
from auth.users u
where lower(u.email) = 'director@withelev8.com'
on conflict (user_id) do update
  set is_active = true,
      email = excluded.email;

insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
from auth.users u
where lower(u.email) = 'director@withelev8.com'
on conflict (user_id, role) do nothing;