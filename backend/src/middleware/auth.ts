import type { NextFunction, Request, RequestHandler, Response } from "express";

import { notAuthenticated, notAuthorised } from "../lib/errors.js";
import { env } from "../lib/env.js";
import { SESSION_COOKIE, readSession } from "../lib/session.js";
import type { AuditActor } from "../models/auditLog.js";
import { findByPersonId, primaryRole, type Identity } from "../models/identity.js";

/**
 * The guards. Routes declare who may call them; controllers never check a
 * role themselves, so "who can do this?" is answerable by reading the route
 * file and nothing else.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by `loadIdentity` when a valid session cookie is present. */
      identity?: Identity;
      /** Always set by `loadIdentity`, even for an anonymous caller. */
      actor: AuditActor;
    }
  }
}

function clientIp(req: Request): string | null {
  // Vercel and most hosts put the real address first in X-Forwarded-For.
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = raw?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || null;
}

/**
 * Reads the session cookie, loads the person, and attaches both the identity
 * and an audit actor. Never rejects: the guards below do that.
 *
 * Roles are read from the database on every request rather than cached in
 * the cookie. One indexed query, and revoking an admin grant takes effect on
 * their next click instead of whenever the cookie happens to expire.
 */
export const loadIdentity: RequestHandler = async (req, _res, next) => {
  const anonymous: AuditActor = {
    personId: null,
    email: null,
    role: "public",
    ip: clientIp(req),
    userAgent: req.headers["user-agent"] ?? null,
  };

  try {
    const personId = readSession(req.cookies?.[SESSION_COOKIE]);
    if (!personId) {
      req.actor = anonymous;
      next();
      return;
    }

    const identity = await findByPersonId(personId);
    if (!identity) {
      // The cookie is validly signed but the person is gone. Treat as signed
      // out rather than erroring — it is what a deleted record should feel
      // like from the browser's side.
      req.actor = anonymous;
      next();
      return;
    }

    req.identity = identity;
    req.actor = {
      personId: identity.personId,
      email: identity.schoolEmail,
      role: primaryRole(identity),
      ip: clientIp(req),
      userAgent: req.headers["user-agent"] ?? null,
    };
    next();
  } catch (error) {
    next(error);
  }
};

function need(
  req: Request,
  predicate: (identity: Identity) => boolean,
  message: string,
): Identity {
  const identity = req.identity;
  if (!identity) throw notAuthenticated();

  // A withdrawn student or a former member of staff keeps their record and
  // loses the portal. Checked before the role, so the message is accurate.
  if (!identity.active) {
    throw notAuthorised(
      "This account is no longer active. Speak to the registry.",
    );
  }

  if (!predicate(identity)) throw notAuthorised(message);
  return identity;
}

/** Signed in as anybody at all. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  try {
    need(req, () => true, "");
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  try {
    need(req, (i) => i.isAdmin, "Only an administrator can do this.");
    next();
  } catch (error) {
    next(error);
  }
};

/** Any member of staff: a lecturer, or an admin, who is also staff. */
export const requireStaff: RequestHandler = (req, _res, next) => {
  try {
    need(req, (i) => i.isStaff, "Only staff can do this.");
    next();
  } catch (error) {
    next(error);
  }
};

export const requireStudent: RequestHandler = (req, _res, next) => {
  try {
    need(req, (i) => i.isStudent, "Only a student can do this.");
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * The timed jobs. They carry CRON_SECRET and no session.
 *
 * A request carrying both is refused: that combination means either a
 * misconfigured client or somebody trying a job endpoint from a signed-in
 * browser, and neither should be allowed to run a job.
 */
export const requireCronSecret: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (!env.CRON_SECRET) {
    next(notAuthorised("Timed jobs are not configured on this server."));
    return;
  }
  const presented = req.headers["x-cron-secret"];
  const value = Array.isArray(presented) ? presented[0] : presented;

  if (!value || value !== env.CRON_SECRET) {
    next(notAuthenticated("This endpoint is for the scheduler."));
    return;
  }
  if (req.cookies?.[SESSION_COOKIE]) {
    next(notAuthorised("A job request must not carry a session cookie."));
    return;
  }

  req.actor = {
    personId: null,
    email: null,
    role: "job",
    ip: clientIp(req),
    userAgent: req.headers["user-agent"] ?? null,
  };
  next();
};

/** Narrowing helper for controllers that run behind one of the guards. */
export function identityOf(req: Request): Identity {
  const identity = req.identity;
  if (!identity) {
    // Reaching here means a controller is mounted without a guard.
    throw notAuthenticated();
  }
  return identity;
}
