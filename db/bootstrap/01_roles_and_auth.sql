-- ---------------------------------------------------------------------------
-- Compatibility layer that lets the application's own migrations run on a
-- plain PostgreSQL server.
--
-- The migrations in supabase/migrations were written against Supabase, which
-- supplies three things that vanilla Postgres does not:
--
--   1. the database roles `anon`, `authenticated` and `service_role`,
--   2. an `auth` schema holding the user table and `auth.uid()`,
--   3. a `storage` schema for uploaded files.
--
-- This file recreates all three, so every migration, row-level-security policy
-- and SECURITY DEFINER function applies byte-for-byte unchanged. The identity
-- of the caller now arrives through the `app.user_id` setting, which the
-- application sets for the duration of each transaction.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- --- Roles ------------------------------------------------------------------
-- NOLOGIN roles that RLS policies are written against. The application logs in
-- as `app_user` and switches to one of these per transaction.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    -- BYPASSRLS mirrors Supabase's service key: trusted server-side code only.
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END
$$;

-- The login role the application connects as. It owns nothing, so row-level
-- security is never silently bypassed by table ownership.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'app_user' NOINHERIT;
  END IF;
END
$$;

GRANT anon, authenticated, service_role TO app_user;

-- --- auth schema ------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

-- Stands in for Supabase's GoTrue user table. Only the columns this
-- application actually reads are kept.
CREATE TABLE IF NOT EXISTS auth.users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text NOT NULL,
  encrypted_password  text,
  raw_user_meta_data  jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_confirmed_at  timestamptz,
  last_sign_in_at     timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key
  ON auth.users (lower(email));

-- Browser sessions. The cookie carries the id; the hash guards against a
-- leaked database dump being replayed as a live session.
CREATE TABLE IF NOT EXISTS auth.sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON auth.sessions (user_id);

-- Single-use invitation and password-reset tokens.
CREATE TABLE IF NOT EXISTS auth.tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  purpose     text NOT NULL CHECK (purpose IN ('invite', 'recovery')),
  token_hash  text NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tokens_user_id_idx ON auth.tokens (user_id);

-- --- auth.uid() -------------------------------------------------------------
-- The hinge of the whole security model. Every RLS policy calls this. Under
-- Supabase it decoded a JWT; here it reads the per-transaction setting that
-- withUser() in src/server/db.ts installs. `true` means "missing is NULL",
-- so an unauthenticated transaction simply has no uid and every policy that
-- requires one denies the row.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.email() TO anon, authenticated, service_role;

-- The application reads auth.users only through the service_role connection.
GRANT SELECT ON auth.users TO authenticated;
GRANT ALL ON auth.users, auth.sessions, auth.tokens TO service_role;

-- --- storage schema ---------------------------------------------------------
-- Inert stub. Uploaded files now live on disk (or S3) behind the application's
-- own access checks -- see src/server/storage.ts. The schema exists only so the
-- one migration that adds a policy to storage.objects still applies cleanly.
CREATE SCHEMA IF NOT EXISTS storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS storage.objects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id  text NOT NULL,
  name       text NOT NULL,
  owner      uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT string_to_array(name, '/');
$$;

-- --- Default privileges -----------------------------------------------------
-- The migrations GRANT explicitly per table, so this only covers the search
-- path and sequences they create along the way.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
