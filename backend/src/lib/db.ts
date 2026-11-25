import pg from "pg";

import { env, isProduction } from "./env.js";
import { logger } from "./logger.js";

/**
 * The one database pool, and the only two ways to reach Postgres.
 *
 * `query` and `tx` both take parameterised SQL. There is no helper here that
 * builds SQL from a string, and there should never be one — the moment a
 * query is assembled by concatenation, every caller becomes a place an
 * injection can happen.
 *
 * Models import this. Controllers must not: see backend/README.md.
 */

const { Pool } = pg;

/**
 * XAF amounts are stored as bigint. node-postgres hands bigint back as a
 * string so that large values survive, which is right in general and wrong
 * for us — the largest fee WIPEG will ever charge is nowhere near
 * Number.MAX_SAFE_INTEGER, and a string that is sometimes a number is a bug
 * waiting to happen in the JSON. Parse it, but refuse anything that would
 * actually lose precision.
 */
pg.types.setTypeParser(20, (value: string) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) {
    throw new Error(
      `A bigint from the database (${value}) is too large to represent exactly.`,
    );
  }
  return n;
});

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Supabase terminates TLS with its own chain; the hosted pooler is not
  // reachable without this and verification is handled at the network layer.
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (error) => {
  // An idle client died. Not fatal — the pool replaces it — but worth seeing.
  logger.error("idle database client errored", { error });
});

export type Sql = string;

/** Run one parameterised statement and get the rows back. */
export async function query<Row extends Record<string, unknown>>(
  sql: Sql,
  params: readonly unknown[] = [],
): Promise<Row[]> {
  const started = Date.now();
  try {
    const result = await pool.query(sql, params as unknown[]);
    return result.rows as Row[];
  } finally {
    const ms = Date.now() - started;
    if (ms > 500) {
      logger.warn("slow query", { ms, sql: sql.replace(/\s+/g, " ").slice(0, 160) });
    }
  }
}

/** The single row, or null. Throws if the query returned more than one. */
export async function queryOne<Row extends Record<string, unknown>>(
  sql: Sql,
  params: readonly unknown[] = [],
): Promise<Row | null> {
  const rows = await query<Row>(sql, params);
  if (rows.length > 1) {
    throw new Error(
      `Expected at most one row, got ${rows.length}. Check the WHERE clause.`,
    );
  }
  return rows[0] ?? null;
}

export type Tx = {
  query: <Row extends Record<string, unknown>>(
    sql: Sql,
    params?: readonly unknown[],
  ) => Promise<Row[]>;
  queryOne: <Row extends Record<string, unknown>>(
    sql: Sql,
    params?: readonly unknown[],
  ) => Promise<Row | null>;
};

/**
 * Run several statements as one unit. Rolls back on any thrown error.
 *
 * Used where a half-finished write would be worse than no write: enrolment
 * (which copies the fee schedule into a snapshot of charges), recording a
 * receipt, and reversing one.
 */
export async function tx<T>(run: (t: Tx) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const handle: Tx = {
      query: async <Row extends Record<string, unknown>>(
        sql: Sql,
        params: readonly unknown[] = [],
      ) => (await client.query(sql, params as unknown[])).rows as Row[],
      queryOne: async <Row extends Record<string, unknown>>(
        sql: Sql,
        params: readonly unknown[] = [],
      ) => {
        const rows = (await client.query(sql, params as unknown[])).rows as Row[];
        if (rows.length > 1) {
          throw new Error(`Expected at most one row, got ${rows.length}.`);
        }
        return rows[0] ?? null;
      },
    };

    const result = await run(handle);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error("rollback failed", { error: rollbackError });
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Used by the health endpoint, and at boot to fail fast on a bad URL. */
export async function pingDatabase(): Promise<void> {
  await query("SELECT 1;");
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

/**
 * Postgres error codes the API turns into something a human can act on.
 * Checking the code is how we stay idempotent without a read-then-write race:
 * insert, and let a unique index be the thing that says "already there".
 */
export const PG = {
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  CHECK_VIOLATION: "23514",
  NOT_NULL_VIOLATION: "23502",
} as const;

export function pgErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

/** The constraint that rejected the write, so a model can say which rule broke. */
export function pgConstraint(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "constraint" in error) {
    const name = (error as { constraint: unknown }).constraint;
    return typeof name === "string" ? name : null;
  }
  return null;
}
