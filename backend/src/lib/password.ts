import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";

/**
 * `promisify(scrypt)` picks the overload without options, so the cost
 * parameters would be silently dropped. Wrapped by hand instead.
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

/**
 * Passwords, for people who sign in without Google.
 *
 * scrypt, from Node's own crypto module. No extra package: bcrypt and argon2
 * are native add-ons that need a C++ toolchain, which is a real obstacle on
 * a Windows laptop and a real obstacle again on whatever host this lands on.
 * scrypt is in the standard library, is designed for exactly this, and is
 * recommended by OWASP for password storage.
 *
 * A stored hash looks like:
 *
 *   scrypt$16384$8$1$<salt base64>$<hash base64>
 *
 * The parameters live inside the string, so raising the cost later does not
 * lock out anybody whose password was hashed with the old settings — their
 * hash still says what it was made with.
 */

const COST = 16_384; // N
const BLOCK_SIZE = 8; // r
const PARALLEL = 1; // p
const KEY_LENGTH = 64;

/** scrypt needs more than the default 32MB at these settings. */
const MAX_MEMORY = 128 * COST * BLOCK_SIZE * 2;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(plain.normalize("NFKC"), salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLEL,
    maxmem: MAX_MEMORY,
  });

  return [
    "scrypt",
    COST,
    BLOCK_SIZE,
    PARALLEL,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/**
 * Check a password against a stored hash.
 *
 * Always compares in constant time, and returns false rather than throwing
 * on a malformed hash — a corrupted row should fail the sign-in, not crash
 * the endpoint for everybody.
 */
export async function verifyPassword(
  plain: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, costRaw, blockRaw, parallelRaw, saltRaw, hashRaw] = parts;
  const N = Number(costRaw);
  const r = Number(blockRaw);
  const p = Number(parallelRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  try {
    const salt = Buffer.from(saltRaw ?? "", "base64");
    const expected = Buffer.from(hashRaw ?? "", "base64");
    const derived = await scryptAsync(
      plain.normalize("NFKC"),
      salt,
      expected.length,
      { N, r, p, maxmem: 128 * N * r * 2 },
    );

    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * What counts as an acceptable password.
 *
 * Length, and nothing else. Rules demanding a capital and a symbol push
 * people towards `Password1!` and towards writing it on the desk; length is
 * what actually resists guessing. The top of the range is there because
 * scrypt will happily chew on a megabyte of text if somebody sends one.
 */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

/** A short, plain reason, or null when the password is fine. */
export function passwordProblem(plain: string): string | null {
  if (plain.length < PASSWORD_MIN) {
    return `Use at least ${PASSWORD_MIN} characters. A short sentence works well.`;
  }
  if (plain.length > PASSWORD_MAX) {
    return `That is too long — keep it under ${PASSWORD_MAX} characters.`;
  }
  // Catches "aaaaaaaaaaaa" and "111111111111", which pass a length check and
  // are guessed in seconds.
  if (new Set(plain).size < 5) {
    return "That is too repetitive. Mix in some different characters.";
  }
  return null;
}
