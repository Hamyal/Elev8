/**
 * Applies the bootstrap files and then every migration in supabase/migrations,
 * in filename order, recording each one in public.schema_migrations so reruns
 * are no-ops.
 *
 * Runs as the database owner (DATABASE_URL), not as the application's
 * app_user role -- the migrations create tables and policies.
 *
 *   node scripts/migrate.mjs           apply pending migrations
 *   node scripts/migrate.mjs --status  list applied / pending
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/elev8";

const sqlFiles = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ({ name: f, path: join(dir, f) }));

function planned() {
  return [
    ...sqlFiles(join(root, "db", "bootstrap")).map((f) => ({ ...f, name: `bootstrap/${f.name}` })),
    ...sqlFiles(join(root, "supabase", "migrations")).map((f) => ({
      ...f,
      name: `migrations/${f.name}`,
    })),
  ];
}

const client = new pg.Client({ connectionString });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS public.schema_migrations (
    name        text PRIMARY KEY,
    applied_at  timestamptz NOT NULL DEFAULT now()
  );
`);

const { rows } = await client.query("SELECT name FROM public.schema_migrations");
const applied = new Set(rows.map((r) => r.name));
const pending = planned().filter((f) => !applied.has(f.name));

if (process.argv.includes("--status")) {
  for (const f of planned()) {
    console.log(`${applied.has(f.name) ? "applied" : "pending"}  ${f.name}`);
  }
  await client.end();
  process.exit(0);
}

if (!pending.length) {
  console.log(`Database is up to date (${applied.size} migrations applied).`);
  await client.end();
  process.exit(0);
}

for (const file of pending) {
  const sql = readFileSync(file.path, "utf8");
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO public.schema_migrations (name) VALUES ($1)", [file.name]);
    await client.query("COMMIT");
    console.log(`applied  ${file.name}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`\nFAILED   ${file.name}\n${error.message}\n`);
    await client.end();
    process.exit(1);
  }
}

console.log(`\nDone. ${pending.length} migration(s) applied.`);
await client.end();
