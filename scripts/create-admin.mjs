/**
 * Creates (or repairs) a Team Portal account with a known password.
 *
 * Under Supabase the first admin arrived through an emailed invitation. With
 * mail delivery optional, this script is the dependable way in: it creates the
 * auth user, its staff profile, and its role in one go, and prints a password
 * you can actually sign in with. Useful for the first Admin, and for making
 * one account per role to demonstrate what each can see.
 *
 *   npm run db:seed-admin -- <email> [role] [password] [full name]
 *
 * Role defaults to admin. Omit the password and one is generated and printed.
 * Running it again for the same address resets that account rather than
 * failing, so it is safe to repeat.
 */
import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const scrypt = promisify(scryptCallback);

const ROLES = ["admin", "hr", "viewer", "employee", "caretaker"];

const args = process.argv.slice(2);
const email = args[0];

// The role is optional and sits in the second slot, so accept it only when it
// actually names a role -- otherwise that argument is the password.
const role = ROLES.includes((args[1] ?? "").toLowerCase()) ? args[1].toLowerCase() : "admin";
const rest = role === (args[1] ?? "").toLowerCase() ? args.slice(2) : args.slice(1);

const passwordArg = rest[0];
const fullName =
  rest.slice(1).join(" ") || `Elev8 ${role.charAt(0).toUpperCase()}${role.slice(1)}`;

if (!email || !email.includes("@")) {
  console.error("Usage: npm run db:seed-admin -- <email> [role] [password] [full name]");
  console.error(`Roles: ${ROLES.join(", ")} (default: admin)`);
  process.exit(1);
}

const password = passwordArg || randomBytes(12).toString("base64url");
if (password.length < 10) {
  console.error("Password must be at least 10 characters.");
  process.exit(1);
}

const salt = randomBytes(16);
const key = await scrypt(password, salt, 64);
const encrypted = `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/elev8",
});
await client.connect();

try {
  await client.query("BEGIN");

  const { rows } = await client.query(
    `INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data, email_confirmed_at)
     VALUES ($1, $2, $3, jsonb_build_object('full_name', $4::text), now())
     ON CONFLICT (lower(email)) DO UPDATE
       SET encrypted_password = EXCLUDED.encrypted_password,
           email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
           updated_at = now()
     RETURNING id`,
    [randomUUID(), email, encrypted, fullName],
  );
  const userId = rows[0].id;

  await client.query(
    `INSERT INTO public.staff_profiles (user_id, full_name, email, is_active)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (user_id) DO UPDATE
       SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, is_active = true`,
    [userId, fullName, email],
  );

  // One role per account: replace whatever was there rather than adding to it.
  await client.query("DELETE FROM public.user_roles WHERE user_id = $1", [userId]);
  await client.query(
    `INSERT INTO public.user_roles (user_id, role)
     VALUES ($1, $2::public.app_role)
     ON CONFLICT (user_id, role) DO NOTHING`,
    [userId, role],
  );

  // Any existing session for this account is invalidated by the password change.
  await client.query("DELETE FROM auth.sessions WHERE user_id = $1", [userId]);

  await client.query("COMMIT");

  console.log(`\nAdmin account ready.\n`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`\nSign in at /team-portal and change this password.\n`);
} catch (error) {
  await client.query("ROLLBACK");
  console.error(`\nFailed: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await client.end();
}
