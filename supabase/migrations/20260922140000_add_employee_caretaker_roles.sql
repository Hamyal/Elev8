-- Adds the Employee and Caretaker roles.
--
-- Enum values are added on their own, without being referenced, because
-- PostgreSQL refuses to use a new enum label in the same transaction that
-- created it. The next migration redefines is_staff() to match.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'employee';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'caretaker';
