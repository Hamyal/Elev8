# Running on PostgreSQL

This app was exported from Lovable with Supabase as its backend. Supabase has
been removed; it now runs against a plain PostgreSQL server.

## What replaced what

| Supabase | Now |
| --- | --- |
| Hosted Postgres + PostgREST | Your own Postgres, queried through `src/server/pgrest.ts` |
| `auth.uid()`, `anon` / `authenticated` / `service_role` | Recreated in `db/bootstrap/01_roles_and_auth.sql` |
| Supabase Auth (GoTrue) | `src/server/auth.ts` — scrypt passwords, cookie sessions, single-use invite links |
| Supabase Storage | `src/server/storage.ts` — files on disk, HMAC-signed links |
| Supabase mailer | `src/server/mailer.ts` — SMTP, or the server log when SMTP is not configured |

**The security model did not change.** All 20 tables keep row-level security,
all 33 policies and every `SECURITY DEFINER` function apply exactly as before.
The database still decides what each role may read and write — it simply learns
who is asking from a transaction-local setting instead of a JWT.

## First run

```sh
cp .env.example .env          # then fill in STORAGE_SIGNING_SECRET
npm install
npm run db:up                 # starts PostgreSQL in Docker
npm run db:migrate            # bootstrap + all 23 migrations
npm run db:seed-admin your@email.com
npm run dev
```

`db:seed-admin` prints the generated password. Sign in at `/team-portal`.

## Using a PostgreSQL server you already have

Skip `db:up` and point `DATABASE_URL` at it. The account in that URL must be
able to create roles and schemas, because the bootstrap migration creates the
`anon`, `authenticated`, `service_role` and `app_user` roles and the `auth`
schema. After migrating you can switch the application to a lower-privileged
connection.

The application should **not** connect as the user that owns the tables — a
table owner bypasses row-level security. The bootstrap creates `app_user` for
this purpose; to use it, change `DATABASE_URL` to
`postgres://app_user:app_user@localhost:5433/elev8` after migrating (and change
that password first on anything but a local machine).

## Migrations

`supabase/migrations/` is unchanged and still the source of truth. The runner
applies `db/bootstrap/` first, then every migration in filename order, and
records each in `public.schema_migrations`, so reruns are no-ops.

```sh
npm run db:status    # what is applied, what is pending
npm run db:migrate   # apply pending
```

New migrations go in `supabase/migrations/` with a sortable timestamp prefix,
matching the existing names.

## Email

Without `SMTP_URL`, staff invitations are not sent — the invitation link is
written to the server log instead, and the admin UI reports that. This is fine
for development. For production, set `SMTP_URL` to a standard connection
string, for example:

```
SMTP_URL=smtps://apikey:SG.xxxx@smtp.sendgrid.net:465
```

## Files

Uploads land under `STORAGE_DIR` (default `./storage`), in `certifications/`
and `application-pdfs/`. Neither is web-reachable: staff open a file through a
ten-minute signed link issued by `createFileLink`, served by
`src/routes/files.$.ts`.

To move to S3 or similar, reimplement `putObject` and `getObject` in
`src/server/storage.ts`. Nothing else needs to change.

## Known gaps

- **Data is not migrated.** This is a working schema, not a copy of production.
  To bring records across, export from Supabase (`pg_dump --data-only`) and
  load it after `db:migrate`; `auth.users` needs its own export, and the stored
  password hashes are bcrypt, which `src/server/auth.ts` does not read — those
  users must set a new password through an invitation link.
- **Files are not migrated.** Existing objects must be copied out of the
  Supabase buckets into `STORAGE_DIR`, keeping their paths.
- The Supabase auth-email templates in `src/lib/email-templates/` are now
  unused; `src/server/mailer.ts` carries its own. They are left in place in
  case the styling is wanted.
