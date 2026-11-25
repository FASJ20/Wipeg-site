import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { Response } from "express";

import { env, isProduction } from "./env.js";

/**
 * Sessions are a signed cookie holding a person id and nothing else.
 *
 * Deliberately *not* a cached copy of the caller's roles. A role lookup on
 * every request costs one indexed query, and it means revoking somebody's
 * admin grant takes effect on their next click rather than whenever their
 * cookie happens to expire. For a system where one role can change fees and
 * matricules, that is the right trade.
 *
 * Signed rather than stored: no session table to clean up, and the secret is
 * already needed for the link tokens. The cost is that a session cannot be
 * revoked individually before it expires — rotate SESSION_SECRET to drop all
 * of them at once, which is the realistic response to a leak anyway.
 */

export const SESSION_COOKIE = "wipeg_session";

type SessionPayload = {
  /** persons.id */
  sub: string;
  /** issued at, epoch seconds */
  iat: number;
  /** expires at, epoch seconds */
  exp: number;
};

const encode = (buf: Buffer | string) =>
  Buffer.from(buf).toString("base64url");

function sign(data: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(data).digest("base64url");
}

export function issueSession(personId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: personId,
    iat: now,
    exp: now + env.SESSION_HOURS * 3600,
  };
  const body = encode(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/** The person id, or null if the cookie is missing, altered or expired. */
export function readSession(raw: string | undefined): string | null {
  if (!raw) return null;

  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;

  const body = raw.slice(0, dot);
  const presented = raw.slice(dot + 1);
  const expected = sign(body);

  // Compare in constant time. Length is checked first because
  // timingSafeEqual throws on a mismatch, which would itself leak length.
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload.sub !== "string" || payload.sub.length === 0) return null;
  if (typeof payload.exp !== "number") return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload.sub;
}

export function setSessionCookie(res: Response, personId: string): void {
  res.cookie(SESSION_COOKIE, issueSession(personId), {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax", // 'lax' so the cookie survives the Google redirect back
    path: "/",
    maxAge: env.SESSION_HOURS * 3600 * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
}

/**
 * The OAuth `state` value, which exists to stop a third party from feeding
 * the callback a code of their own choosing. Signed the same way, with a
 * short life, and carrying where to send the user afterwards.
 */
const OAUTH_STATE_SECONDS = 600;

export function issueOAuthState(returnTo: string): string {
  const now = Math.floor(Date.now() / 1000);
  const body = encode(
    JSON.stringify({ n: randomBytes(12).toString("base64url"), returnTo, exp: now + OAUTH_STATE_SECONDS }),
  );
  return `${body}.${sign(body)}`;
}

export function readOAuthState(raw: string | undefined): { returnTo: string } | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;

  const body = raw.slice(0, dot);
  const a = Buffer.from(raw.slice(dot + 1));
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { returnTo: typeof payload.returnTo === "string" ? payload.returnTo : "/" };
  } catch {
    return null;
  }
}
