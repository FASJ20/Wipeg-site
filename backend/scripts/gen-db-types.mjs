/**
 * Regenerate src/db/types.ts from a live database, then correct one thing
 * the generator cannot know.
 *
 *   npm run db:types          (reads DATABASE_URL from backend/.env)
 *
 * The correction: money is stored as bigint, and node-postgres hands bigint
 * back as a string by default — which is what the generator assumes. We
 * install a parser in src/lib/db.ts that turns it into a number instead,
 * because XAF amounts are nowhere near the safe-integer limit and a value
 * that is sometimes a string and sometimes a number causes real bugs.
 *
 * So the generated `Int8` type is rewritten to match what actually arrives
 * at runtime. Without this, every fee amount is typed `string` and is a
 * number, and TypeScript protects nobody.
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/db/types.ts";

const GENERATED =
  "export type Int8 = ColumnType<string, bigint | number | string, bigint | number | string>;";

const CORRECTED = `/**
 * Money, in whole francs.
 *
 * Rewritten by scripts/gen-db-types.mjs: the generator assumes bigint arrives
 * as a string, but src/lib/db.ts installs a parser that makes it a number.
 * This type matches runtime, not the default.
 */
export type Int8 = ColumnType<number, bigint | number | string, bigint | number | string>;`;

const source = readFileSync(FILE, "utf8");

if (!source.includes(GENERATED)) {
  if (source.includes("export type Int8 = ColumnType<number,")) {
    console.log("Int8 already corrected — nothing to do.");
    process.exit(0);
  }
  console.error(
    `Could not find the generated Int8 line in ${FILE}.\n` +
      "kysely-codegen has probably changed its output. Check it by hand.",
  );
  process.exit(1);
}

writeFileSync(FILE, source.replace(GENERATED, CORRECTED), "utf8");
console.log("Int8 corrected to number.");
