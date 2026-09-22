/**
 * A small PostgREST-shaped query builder over a `pg` client.
 *
 * The ATS server functions were written against the Supabase JS client's
 * builder API -- `.from(t).select(c).eq(k, v).maybeSingle()` and
 * `.rpc(name, args)`. Rewriting those ~1,500 lines as raw SQL would have meant
 * re-deriving every filter and every error path by hand, so this module
 * reimplements the slice of that API the application actually uses and leaves
 * the call sites untouched.
 *
 * Two properties are deliberately preserved:
 *
 *   - Results are returned as `{ data, error }` rather than thrown, because
 *     every call site branches on `error`.
 *   - The client is bound to one transaction, so the role and `app.user_id`
 *     set by withRole() in db.ts govern every statement it issues. Row-level
 *     security therefore still decides what comes back.
 *
 * Only the surface the application uses is implemented. Anything else throws
 * loudly rather than silently returning wrong rows -- notably PostgREST's
 * embedded-resource syntax (select with a nested table), which this codebase
 * never uses.
 */
import type { PoolClient, QueryResult } from "pg";
import { withRole, type DbRole } from "./db";

/**
 * How a built statement actually reaches the database. Binding the builder to
 * an executor rather than a connection lets the same code serve both the
 * request-scoped transaction (where several statements share one identity) and
 * the service-role helper (where each statement stands alone).
 */
export type Executor = (text: string, values: unknown[]) => Promise<QueryResult>;

export type PgRestError = { message: string; code?: string | undefined; details?: string | undefined };
export type PgRestResult<T = any> = { data: T; error: PgRestError | null };

const ident = (name: string) => {
  const trimmed = name.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
    throw new Error(`Unsupported SQL identifier: ${name}`);
  }
  return `"${trimmed}"`;
};

/** Splits a PostgREST column list, rejecting the embedded-resource syntax. */
function columnList(columns: string): string {
  const spec = columns.trim();
  if (!spec || spec === "*") return "*";
  if (spec.includes("(")) {
    throw new Error(
      `Embedded resource selects are not supported by the PostgreSQL adapter: "${columns}"`,
    );
  }
  return spec
    .split(",")
    .map((part) => {
      const col = part.trim();
      // "alias:column" renames, the one PostgREST flourish worth keeping.
      const [left, right] = col.includes(":") ? col.split(":") : [null, col];
      return left ? `${ident(right!)} AS ${ident(left)}` : ident(col);
    })
    .join(", ");
}

type Param = (value: unknown) => string;
type Filter = { sql: (param: Param) => string };

type Operation =
  | { kind: "select" }
  | { kind: "insert"; rows: Record<string, unknown>[] }
  | { kind: "update"; values: Record<string, unknown> }
  | { kind: "upsert"; rows: Record<string, unknown>[]; onConflict: string[] }
  | { kind: "delete" };

/** True for values that must be sent as jsonb rather than a Postgres record. */
function isJsonValue(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !Buffer.isBuffer(value)
  );
}

class QueryBuilder<T = any> implements PromiseLike<PgRestResult<T>> {
  private readonly exec: Executor;
  private readonly table: string;
  private op: Operation = { kind: "select" };
  private columns = "*";
  private returning = false;
  private filters: Filter[] = [];
  private orderBy: string[] = [];
  private rowLimit: number | null = null;
  private rowMode: "many" | "single" | "maybe" = "many";

  constructor(exec: Executor, table: string) {
    this.exec = exec;
    this.table = table;
  }

  // --- projection -----------------------------------------------------------

  select(columns = "*") {
    this.columns = columns;
    // On a mutation, .select() is what asks for the changed rows back.
    if (this.op.kind !== "select") this.returning = true;
    return this;
  }

  // --- mutations ------------------------------------------------------------

  insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
    this.op = { kind: "insert", rows: Array.isArray(rows) ? rows : [rows] };
    return this;
  }

  update(values: Record<string, unknown>) {
    this.op = { kind: "update", values };
    return this;
  }

  upsert(
    rows: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string },
  ) {
    const onConflict = (options?.onConflict ?? "id")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    this.op = { kind: "upsert", rows: Array.isArray(rows) ? rows : [rows], onConflict };
    return this;
  }

  delete() {
    this.op = { kind: "delete" };
    return this;
  }

  // --- filters --------------------------------------------------------------

  private cmp(column: string, operator: string, value: unknown) {
    this.filters.push({ sql: (param) => `${ident(column)} ${operator} ${param(value)}` });
    return this;
  }

  eq(column: string, value: unknown) {
    // PostgREST treats a null equality filter as IS NULL.
    if (value === null) return this.is(column, null);
    return this.cmp(column, "=", value);
  }
  neq(column: string, value: unknown) {
    return this.cmp(column, "<>", value);
  }
  gt(column: string, value: unknown) {
    return this.cmp(column, ">", value);
  }
  gte(column: string, value: unknown) {
    return this.cmp(column, ">=", value);
  }
  lt(column: string, value: unknown) {
    return this.cmp(column, "<", value);
  }
  lte(column: string, value: unknown) {
    return this.cmp(column, "<=", value);
  }
  like(column: string, pattern: string) {
    return this.cmp(column, "LIKE", pattern);
  }
  ilike(column: string, pattern: string) {
    return this.cmp(column, "ILIKE", pattern);
  }

  is(column: string, value: null | boolean) {
    const literal = value === null ? "NULL" : value ? "TRUE" : "FALSE";
    this.filters.push({ sql: () => `${ident(column)} IS ${literal}` });
    return this;
  }

  in(column: string, values: readonly unknown[]) {
    // An empty list must match nothing, which `= ANY('{}')` does correctly.
    this.filters.push({ sql: (param) => `${ident(column)} = ANY(${param([...values])})` });
    return this;
  }

  contains(column: string, value: unknown) {
    this.filters.push({ sql: (param) => `${ident(column)} @> ${param(value)}` });
    return this;
  }

  match(criteria: Record<string, unknown>) {
    for (const [column, value] of Object.entries(criteria)) this.eq(column, value);
    return this;
  }

  // --- shaping --------------------------------------------------------------

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    const direction = options?.ascending === false ? "DESC" : "ASC";
    const nulls =
      options?.nullsFirst === undefined ? "" : options.nullsFirst ? " NULLS FIRST" : " NULLS LAST";
    this.orderBy.push(`${ident(column)} ${direction}${nulls}`);
    return this;
  }

  limit(count: number) {
    this.rowLimit = count;
    return this;
  }

  single() {
    this.rowMode = "single";
    return this;
  }

  maybeSingle() {
    this.rowMode = "maybe";
    return this;
  }

  /** Type-only passthrough, mirroring the Supabase client. */
  returns<U>(): QueryBuilder<U> {
    return this as unknown as QueryBuilder<U>;
  }

  // --- execution ------------------------------------------------------------

  private build(): { text: string; values: unknown[] } {
    const values: unknown[] = [];
    const param: Param = (value) => {
      const json = isJsonValue(value);
      values.push(json ? JSON.stringify(value) : value);
      return json ? `$${values.length}::jsonb` : `$${values.length}`;
    };

    const table = `public.${ident(this.table)}`;
    const whereClause = () =>
      this.filters.length ? ` WHERE ${this.filters.map((f) => f.sql(param)).join(" AND ")}` : "";

    switch (this.op.kind) {
      case "select": {
        const where = whereClause();
        const order = this.orderBy.length ? ` ORDER BY ${this.orderBy.join(", ")}` : "";
        const limit = this.rowLimit === null ? "" : ` LIMIT ${Number(this.rowLimit)}`;
        return {
          text: `SELECT ${columnList(this.columns)} FROM ${table}${where}${order}${limit}`,
          values,
        };
      }

      case "insert":
      case "upsert": {
        const { rows } = this.op;
        if (!rows.length) return { text: "SELECT 1 WHERE false", values };
        // Every row presents the same columns, as PostgREST requires.
        const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
        const tuples = rows
          .map((row) => `(${columns.map((c) => param(row[c] ?? null)).join(", ")})`)
          .join(", ");

        let conflict = "";
        if (this.op.kind === "upsert") {
          const keys = this.op.onConflict;
          const target = keys.map(ident).join(", ");
          const assignments = columns
            .filter((c) => !keys.includes(c))
            .map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`);
          conflict = assignments.length
            ? ` ON CONFLICT (${target}) DO UPDATE SET ${assignments.join(", ")}`
            : ` ON CONFLICT (${target}) DO NOTHING`;
        }

        const returning = this.returning ? ` RETURNING ${columnList(this.columns)}` : "";
        return {
          text: `INSERT INTO ${table} (${columns.map(ident).join(", ")}) VALUES ${tuples}${conflict}${returning}`,
          values,
        };
      }

      case "update": {
        const entries = Object.entries(this.op.values);
        if (!entries.length) throw new Error("update() requires at least one column");
        // SET is built before WHERE so its parameters are numbered first.
        const assignments = entries.map(([c, v]) => `${ident(c)} = ${param(v)}`).join(", ");
        const where = whereClause();
        const returning = this.returning ? ` RETURNING ${columnList(this.columns)}` : "";
        return { text: `UPDATE ${table} SET ${assignments}${where}${returning}`, values };
      }

      case "delete": {
        const where = whereClause();
        const returning = this.returning ? ` RETURNING ${columnList(this.columns)}` : "";
        return { text: `DELETE FROM ${table}${where}${returning}`, values };
      }
    }
  }

  private async run(): Promise<PgRestResult<T>> {
    let text: string;
    let values: unknown[];
    try {
      ({ text, values } = this.build());
    } catch (error) {
      return { data: null as T, error: { message: (error as Error).message } };
    }

    try {
      const result = await this.exec(text, values);
      const rows = result.rows ?? [];

      if (this.rowMode === "single") {
        if (rows.length !== 1) {
          return {
            data: null as T,
            error: {
              message:
                rows.length === 0
                  ? "JSON object requested, no rows returned"
                  : "JSON object requested, multiple rows returned",
              code: "PGRST116",
            },
          };
        }
        return { data: rows[0] as T, error: null };
      }

      if (this.rowMode === "maybe") {
        if (rows.length > 1) {
          return {
            data: null as T,
            error: { message: "JSON object requested, multiple rows returned", code: "PGRST116" },
          };
        }
        return { data: (rows[0] ?? null) as T, error: null };
      }

      // A mutation without .select() reports success with no body, as PostgREST does.
      if (this.op.kind !== "select" && !this.returning) {
        return { data: null as T, error: null };
      }
      return { data: rows as T, error: null };
    } catch (error) {
      const pgError = error as Error & { code?: string; detail?: string };
      return {
        data: null as T,
        error: { message: pgError.message, code: pgError.code, details: pgError.detail },
      };
    }
  }

  then<R1 = PgRestResult<T>, R2 = never>(
    onfulfilled?: ((value: PgRestResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

/**
 * Calls a database function the way PostgREST's rpc endpoint did: named
 * arguments, results as rows.
 *
 * `SELECT * FROM fn(...)` covers both shapes the application relies on -- the
 * set-returning reporting functions, and the scalar workflow mutations whose
 * callers only inspect `error`.
 */
async function callFunction(
  exec: Executor,
  fn: string,
  args: Record<string, unknown> = {},
): Promise<PgRestResult> {
  const values: unknown[] = [];
  let named: string;
  try {
    named = Object.entries(args)
      .map(([key, value]) => {
        const json = isJsonValue(value) || Array.isArray(value);
        values.push(json ? JSON.stringify(value) : value);
        return `${ident(key)} => $${values.length}${json ? "::jsonb" : ""}`;
      })
      .join(", ");
  } catch (error) {
    return { data: null, error: { message: (error as Error).message } };
  }

  try {
    const result = await exec(`SELECT * FROM public.${ident(fn)}(${named})`, values);
    return { data: result.rows ?? [], error: null };
  } catch (error) {
    const pgError = error as Error & { code?: string; detail?: string };
    return {
      data: null,
      error: { message: pgError.message, code: pgError.code, details: pgError.detail },
    };
  }
}

export type PgRestClient = {
  from: (table: string) => QueryBuilder;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<PgRestResult>;
};

/** Wraps one transaction-bound pg client in the builder API. */
export function pgRest(client: PoolClient): PgRestClient {
  const exec: Executor = (text, values) => client.query(text, values as any[]);
  return {
    from: (table: string) => new QueryBuilder(exec, table),
    rpc: (fn: string, args?: Record<string, unknown>) => callFunction(exec, fn, args),
  };
}

/**
 * A client whose statements each run in their own short transaction under the
 * given role. Used by the service-role helper, where call sites await one
 * statement at a time rather than sharing a request transaction.
 */
export function pgRestAuto(role: DbRole, userId: string | null = null): PgRestClient {
  const exec: Executor = (text, values) =>
    withRole(role, userId, (client) => client.query(text, values as any[]));
  return {
    from: (table: string) => new QueryBuilder(exec, table),
    rpc: (fn: string, args?: Record<string, unknown>) => callFunction(exec, fn, args),
  };
}
