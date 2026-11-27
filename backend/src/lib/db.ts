import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";

import type { DB } from "../db/types.js";
import { env, isProduction } from "./env.js";
import { logger } from "./logger.js";

/**
 * The database, reached through Kysely.
 *
 * Kysely is a query builder, not an ORM. It generates exactly the query you
 * write — no lazy loading, no hidden joins, no magic. What it adds is that
 * the column names and their types come from `src/db/types.ts`, which is
 * generated from `db/schema.sql` itself. Rename a column in the schema and
 * the build breaks, instead of production breaking.
 *
 * That is the whole reason it is here rather than an ORM: the database
 * already enforces WIPEG's rules (one active enrolment per student, Level 1
 * is department-wide, instalments must sum to the total). An ORM hides the
 * database and sometimes generates queries around those rules. Kysely cannot,
 * because it never writes a query you did not.
 *
 * Models import `db`. Controllers must not: see backend/README.md.
 */

const { Pool } = pg;

/**
 * Money is stored as bigint. node-postgres returns bigint as a string so that
 * huge values survive, which is right in general and wrong for us — the
 * biggest fee WIPEG will ever charge is nowhere near the safe integer limit,
 * and a value that is sometimes a string and sometimes a number is a bug
 * waiting to happen in JSON. Parse it, but refuse anything that really would
 * lose precision rather than silently rounding it.
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
  // reachable without this, and verification happens at the network layer.
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (error) => {
  // An idle client died. Not fatal — the pool replaces it — but worth seeing.
  logger.error("idle database client errored", { error });
});

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({ pool }),
  log: (event) => {
    if (event.level === "error") {
      logger.error("query failed", {
        ms: Math.round(event.queryDurationMillis),
        sql: event.query.sql.slice(0, 200),
      });
      return;
    }
    if (event.queryDurationMillis > 500) {
      logger.warn("slow query", {
        ms: Math.round(event.queryDurationMillis),
        sql: event.query.sql.slice(0, 200),
      });
    }
  },
});

/**
 * Kysely's raw SQL tag, for the handful of places a query builder is the
 * wrong tool — `LATERAL` joins in the fee views, mostly.
 *
 * Still parameterised: values interpolated into this tag become bind
 * parameters, they are not pasted into the string. There is deliberately no
 * helper anywhere in this codebase that builds SQL by concatenation.
 */
export { sql };

/** Used by the health endpoint, and at boot to fail fast on a bad URL. */
export async function pingDatabase(): Promise<void> {
  await sql`SELECT 1`.execute(db);
}

export async function closeDatabase(): Promise<void> {
  await db.destroy();
}

/**
 * Postgres error codes the API turns into something a human can act on.
 *
 * Checking the code is how writes stay idempotent without a check-then-insert
 * race: insert, and let a unique index be the thing that says "already there".
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

/** The constraint that rejected a write, so a model can name the rule broken. */
export function pgConstraint(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "constraint" in error) {
    const name = (error as { constraint: unknown }).constraint;
    return typeof name === "string" ? name : null;
  }
  return null;
}
