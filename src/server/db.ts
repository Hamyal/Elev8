/**
 * PostgreSQL connection pool and the transaction helpers that carry the
 * caller's identity into the database.
 *
 * Row-level security is still the enforcement boundary, exactly as it was
 * under Supabase. The difference is only how the database learns who is
 * asking: instead of a JWT decoded by PostgREST, each transaction runs
 *
 *     SET LOCAL ROLE authenticated;
 *     SET LOCAL app.user_id = '<uuid>';
 *
 * and auth.uid() (see db/bootstrap/01_roles_and_auth.sql) reads that setting.
 * SET LOCAL is scoped to the transaction, so a pooled connection can never
 * leak one request's identity into the next.
 *
 * Server-only. Never import this from a route or component module.
 */
import pg from "pg";

// Timestamps come back as ISO strings rather than local-time Date objects, so
// values round-trip to the browser exactly as PostgREST used to send them.
pg.types.setTypeParser(1114, (v) => (v === null ? null : new Date(v + "Z").toISOString()));
pg.types.setTypeParser(1184, (v) => (v === null ? null : new Date(v).toISOString()));
// bigint and numeric stay strings by default; the app expects numbers.
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

let _pool: pg.Pool | undefined;

export function pool(): pg.Pool {
  if (_pool) return _pool;

  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error(
      "Missing DATABASE_URL. Copy .env.example to .env and point it at your PostgreSQL server.",
    );
  }

  _pool = new pg.Pool({
    connectionString,
    max: Number(process.env["DATABASE_POOL_MAX"] ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ...(process.env["DATABASE_SSL"] === "true" ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  _pool.on("error", (error) => {
    console.error("[db] idle client error", error);
  });

  return _pool;
}

export type DbRole = "anon" | "authenticated" | "service_role";

/**
 * Runs `fn` inside a transaction that impersonates `role` and, when given,
 * presents `userId` to auth.uid().
 *
 * Every statement the callback issues is subject to the same policies the
 * Supabase deployment enforced.
 */
export async function withRole<T>(
  role: DbRole,
  userId: string | null,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    // Role names are from the DbRole union, never from user input, so the
    // identifier cannot be injected here.
    await client.query(`SET LOCAL ROLE ${role}`);
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId ?? ""]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Trusted server-side work that intentionally bypasses row-level security. */
export function asServiceRole<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  return withRole("service_role", null, fn);
}

/** Work performed on behalf of a signed-in staff member. */
export function asUser<T>(userId: string, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  return withRole("authenticated", userId, fn);
}

/** Work performed for an unauthenticated visitor (the public application form). */
export function asAnon<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  return withRole("anon", null, fn);
}
