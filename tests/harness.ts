/**
 * Minimal test harness.
 *
 * Every check runs in its own database transaction. That matters here: these
 * tests deliberately provoke failures, and in PostgreSQL a failed statement
 * poisons the rest of its transaction, so sharing one would make each failure
 * cascade into the next check.
 */
import { randomUUID } from "node:crypto";
import { withRole, asServiceRole, pool, type DbRole } from "@srv/db";
import { pgRest, type PgRestClient } from "@srv/pgrest";

type Result = { label: string; ok: boolean; detail: string };

const results: Result[] = [];
let currentSection = "";

export function section(name: string) {
  currentSection = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

export function record(label: string, ok: boolean, detail = "") {
  results.push({ label: `${currentSection} :: ${label}`, ok, detail });
  const mark = ok ? "\x1b[32m  ok  \x1b[0m" : "\x1b[31m FAIL \x1b[0m";
  console.log(`${mark} ${label}${detail && !ok ? `\n         ${detail}` : ""}`);
}

export function check(label: string, ok: boolean, detail = "") {
  record(label, ok, detail);
}

export function equal(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  record(
    label,
    ok,
    ok ? "" : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

/** Runs a block as the given identity, in a transaction of its own. */
export function as<T>(role: DbRole, userId: string | null, fn: (db: PgRestClient) => Promise<T>) {
  return withRole(role, userId, (client) => fn(pgRest(client)));
}

/**
 * Asserts an operation succeeds. `fn` returns the `{ data, error }` the app
 * itself would branch on.
 */
export async function expectOk(
  label: string,
  role: DbRole,
  userId: string | null,
  fn: (db: PgRestClient) => Promise<{ error: { message: string } | null; data?: unknown }>,
) {
  try {
    const result = await as(role, userId, fn);
    record(label, !result.error, result.error?.message ?? "");
    return result;
  } catch (error) {
    record(label, false, (error as Error).message);
    return { data: null, error: { message: (error as Error).message } };
  }
}

/** Asserts an operation is refused, and that the refusal says the right thing. */
export async function expectFail(
  label: string,
  role: DbRole,
  userId: string | null,
  fn: (db: PgRestClient) => Promise<{ error: { message: string } | null }>,
  expectedMessage: RegExp,
) {
  try {
    const result = await as(role, userId, fn);
    if (!result.error) {
      record(label, false, "the operation was allowed when it should have been refused");
      return;
    }
    const matches = expectedMessage.test(result.error.message);
    record(label, matches, matches ? "" : `refused, but with: "${result.error.message}"`);
  } catch (error) {
    const message = (error as Error).message;
    record(label, expectedMessage.test(message), `threw: ${message}`);
  }
}

// --- fixtures ---------------------------------------------------------------

export type TestUser = {
  id: string;
  email: string;
  role: "admin" | "hr" | "viewer" | "employee" | "caretaker";
};

/** Creates a staff account with the given role. */
export async function createStaff(role: TestUser["role"], label: string): Promise<TestUser> {
  const id = randomUUID();
  const email = `${label}-${id.slice(0, 8)}@test.invalid`;
  await asServiceRole(async (client) => {
    await client.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
       VALUES ($1, $2, jsonb_build_object('full_name', $3::text), now())`,
      [id, email, `Test ${role}`],
    );
    await client.query(
      `INSERT INTO public.staff_profiles (user_id, full_name, email, is_active)
       VALUES ($1, $2, $3, true)`,
      [id, `Test ${role}`, email],
    );
    await client.query(`INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2)`, [id, role]);
  });
  return { id, email, role };
}

/** Creates a submitted application, as the public intake would. */
export async function createApplication(name: string): Promise<{ id: string; reference: string }> {
  const reference = `TST-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`;
  return asServiceRole(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO public.applications
         (reference, first_name, last_name, email, phone, opportunity_pref, application_data)
       VALUES ($1, $2, 'Applicant', $3, '5550000000', 'Employment', '{}'::jsonb)
       RETURNING id, reference`,
      [reference, name, `${name.toLowerCase()}@test.invalid`],
    );
    return { id: rows[0].id, reference: rows[0].reference };
  });
}

/** Reads an application's workflow columns directly, bypassing policy. */
export async function applicationState(id: string) {
  return asServiceRole(async (client) => {
    const { rows } = await client.query(
      `SELECT status, current_milestone, next_action, milestone_due_at,
              milestone_completed_at, closed_other_reason, assigned_to
         FROM public.applications WHERE id = $1`,
      [id],
    );
    return rows[0];
  });
}

export async function eventTypes(applicationId: string): Promise<string[]> {
  return asServiceRole(async (client) => {
    const { rows } = await client.query(
      `SELECT event_type FROM public.application_events
        WHERE application_id = $1 ORDER BY created_at, id`,
      [applicationId],
    );
    return rows.map((r) => r.event_type);
  });
}

/** Removes everything this run created. */
export async function cleanup(applicationIds: string[], userIds: string[]) {
  await asServiceRole(async (client) => {
    for (const id of applicationIds) {
      await client.query(`DELETE FROM public.applications WHERE id = $1`, [id]);
    }
    for (const id of userIds) {
      await client.query(`DELETE FROM public.user_roles WHERE user_id = $1`, [id]);
      await client.query(`DELETE FROM public.staff_profiles WHERE user_id = $1`, [id]);
      await client.query(`DELETE FROM auth.users WHERE id = $1`, [id]);
    }
  });
}

export async function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${"─".repeat(60)}`);
  console.log(
    `${results.length} checks, ${results.length - failed.length} passed, ${failed.length} failed`,
  );
  if (failed.length) {
    console.log("\nFailures:");
    for (const f of failed) console.log(`  - ${f.label}\n      ${f.detail}`);
  }
  await pool().end();
  process.exit(failed.length ? 1 : 0);
}
