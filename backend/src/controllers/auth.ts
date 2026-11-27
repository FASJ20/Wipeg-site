import type { Request, Response } from "express";
import { z } from "zod";

import { env } from "../lib/env.js";
import { PG, pgErrorCode } from "../lib/db.js";
import { badRequest, conflict, notAuthorised } from "../lib/errors.js";
import { created, ok } from "../lib/http.js";
import { logger } from "../lib/logger.js";
import {
  clearSessionCookie,
  issueOAuthState,
  readOAuthState,
  setSessionCookie,
} from "../lib/session.js";
import * as audit from "../models/auditLog.js";
import {
  findByGoogleSub,
  findByPersonId,
  findBySchoolEmail,
  linkGoogleAccount,
  primaryRole,
  stampSignIn,
} from "../models/identity.js";
import * as requests from "../models/accountRequests.js";
import { findPersonForPasswordLogin } from "../models/accountRequests.js";
import {
  hashPassword,
  PASSWORD_MAX,
  PASSWORD_MIN,
  passwordProblem,
  verifyPassword,
} from "../lib/password.js";
import { exchangeCodeForIdentity, signInUrl } from "../services/google/oauth.js";

/**
 * Signing in. There is no password anywhere in this system.
 *
 * The flow: the browser is sent to Google, comes back with a code, the code
 * is exchanged for a verified identity, and that identity is matched to a
 * `persons` row. A Workspace account with no matching person record is
 * refused — having an @wipeg.online address makes you a member of the
 * institution, not automatically a user of its records system.
 */

/** Only ever redirect inside our own site. */
function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "/";
  // Reject anything that could leave the site: absolute URLs, protocol
  // relative URLs, and backslash tricks that some browsers normalise.
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }
  return value;
}

export function start(req: Request, res: Response): void {
  const state = issueOAuthState(safeReturnTo(req.query.returnTo));
  res.redirect(signInUrl(state));
}

export async function callback(req: Request, res: Response): Promise<void> {
  const failureUrl = (reason: string) =>
    `${env.PUBLIC_SITE_ORIGIN}/sign-in?error=${encodeURIComponent(reason)}`;

  if (typeof req.query.error === "string") {
    // The person pressed cancel on Google's screen. Not an error worth a 500.
    res.redirect(failureUrl("cancelled"));
    return;
  }

  const code = req.query.code;
  if (typeof code !== "string" || code.length === 0) {
    throw badRequest("The sign-in response from Google was incomplete.");
  }

  const state = readOAuthState(
    typeof req.query.state === "string" ? req.query.state : undefined,
  );
  if (!state) {
    // Either expired, or the callback was not started by us.
    throw notAuthorised("That sign-in link has expired. Please try again.");
  }

  const google = await exchangeCodeForIdentity(code);

  // Match on Google's subject id first: it survives an address change in the
  // Admin console, which the email does not.
  let identity = await findByGoogleSub(google.googleSub);

  if (!identity) {
    // First sign-in. The registry created the person and the Workspace
    // account; this is the moment the two are bound together.
    const byEmail = await findBySchoolEmail(google.email);
    if (!byEmail) {
      logger.warn("sign-in refused: no person record", { email: google.email });
      await audit.record(
        {
          personId: null,
          email: google.email,
          role: "public",
          ip: req.actor?.ip ?? null,
          userAgent: req.actor?.userAgent ?? null,
        },
        {
          action: "sign_in_refused",
          entity: "persons",
          summary: `${google.email} signed in with Google but has no WIPEG record.`,
        },
      );
      res.redirect(failureUrl("no_record"));
      return;
    }

    await linkGoogleAccount(byEmail.personId, google.googleSub, google.email);
    identity = { ...byEmail, schoolEmail: google.email };

    await audit.record(
      {
        personId: identity.personId,
        email: google.email,
        role: primaryRole(identity),
        ip: req.actor?.ip ?? null,
        userAgent: req.actor?.userAgent ?? null,
      },
      {
        action: "link_google_account",
        entity: "persons",
        entityId: identity.personId,
        summary: `${google.email} signed in for the first time.`,
      },
    );
  } else {
    await stampSignIn(identity.personId);
  }

  if (!identity.active) {
    res.redirect(failureUrl("inactive"));
    return;
  }

  setSessionCookie(res, identity.personId);
  logger.info("signed in", {
    email: identity.schoolEmail,
    role: primaryRole(identity),
  });

  res.redirect(`${env.PUBLIC_SITE_ORIGIN}${state.returnTo}`);
}

export function signOut(req: Request, res: Response): void {
  clearSessionCookie(res);
  ok(res, { signedOut: true });
}

// ------------------------------------------------------- password sign-in

export const passwordLoginBody = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

/**
 * Signing in with an email and a password.
 *
 * Sits alongside Google rather than replacing it. Staff on the Workspace use
 * Google; a student who has registered but not yet been issued an
 * @wipeg.online address has nothing to sign in with otherwise.
 *
 * Three things this does on purpose:
 *
 *   1. The same message for a wrong password and an unknown address. Telling
 *      them apart hands an attacker a list of who has an account here.
 *   2. The hash is verified even when the address is unknown, against a
 *      throwaway hash. Otherwise an unknown address answers in a millisecond
 *      and a real one takes a hundred, which is the same disclosure by a
 *      slower route.
 *   3. Inactive accounts are refused after the password check, not before,
 *      for the same reason.
 */
export async function signInWithPassword(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as z.infer<typeof passwordLoginBody>;
  const wrong = notAuthorised("That email address and password do not match.");

  const found = await findPersonForPasswordLogin(body.email);

  const matches = await verifyPassword(
    body.password,
    found?.password_hash ?? null,
  );
  if (!found || !matches) {
    logger.warn("failed password sign-in", { email: body.email });
    throw wrong;
  }

  const identity = await findByPersonId(found.id);
  if (!identity) throw wrong;

  if (!identity.active) {
    throw notAuthorised(
      "This account is not active yet. The registry will be in touch.",
    );
  }

  await stampSignIn(identity.personId);
  setSessionCookie(res, identity.personId);

  await audit.record(
    {
      personId: identity.personId,
      email: identity.schoolEmail ?? body.email,
      role: primaryRole(identity),
      ip: req.actor?.ip ?? null,
      userAgent: req.actor?.userAgent ?? null,
    },
    {
      action: "sign_in_password",
      entity: "persons",
      entityId: identity.personId,
      summary: `${body.email} signed in with a password.`,
    },
  );

  ok(res, {
    personId: identity.personId,
    name: `${identity.givenNames} ${identity.surname}`.trim(),
    role: primaryRole(identity),
  });
}

/**
 * Registration, for all three kinds of user.
 *
 * Three separate addresses so the website can put them behind three separate
 * pages — students on the public site, lecturers and admins on their own
 * portals. They share this code because the difference between them is one
 * field, and two copies of a registration form drift apart.
 *
 * None of them grants anything. Every one writes a row to a queue that an
 * existing admin has to approve. A stranger who finds the admin registration
 * address can add themselves to a list and nothing more.
 */

const password = z
  .string()
  .min(PASSWORD_MIN)
  .max(PASSWORD_MAX)
  .superRefine((value, ctx) => {
    const problem = passwordProblem(value);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  });

const base = {
  surname: z.string().trim().min(2).max(120),
  givenNames: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z
    .string()
    .trim()
    .regex(/^\+[0-9]{8,15}$/, "Use the international form, like +237677487127."),
  password,
};

export const studentBody = z.object({
  ...base,
  campusId: z.string().uuid(),
  departmentId: z.string().uuid(),
  levelApplied: z.coerce.number().int().min(1).max(5),
  message: z.string().trim().max(1000).optional(),
});

/** Staff are not applying to study anything, so no campus or level. */
export const staffBody = z.object({
  ...base,
  departmentId: z.string().uuid().optional(),
  message: z.string().trim().max(1000).optional(),
});

async function submit(
  req: Request,
  res: Response,
  kind: requests.RequestKind,
  input: {
    surname: string;
    givenNames: string;
    email: string;
    phone: string;
    password: string;
    campusId?: string;
    departmentId?: string;
    levelApplied?: number;
    message?: string;
  },
) {
  const existing = await requests.pendingForEmail(input.email);
  if (existing) {
    throw conflict(
      "There is already a request waiting on that email address. The registry will be in touch.",
    );
  }

  const passwordHash = await hashPassword(input.password);

  let row;
  try {
    row = await requests.create({
      kind,
      surname: input.surname,
      givenNames: input.givenNames,
      email: input.email,
      phone: input.phone,
      passwordHash,
      campusId: input.campusId ?? null,
      departmentId: input.departmentId ?? null,
      levelApplied: input.levelApplied ?? null,
      message: input.message ?? null,
    });
  } catch (error) {
    // Two people pressing submit at the same instant. The partial unique
    // index catches it, which is why there is no check-then-insert race here.
    if (pgErrorCode(error) === PG.UNIQUE_VIOLATION) {
      throw conflict(
        "There is already a request waiting on that email address.",
      );
    }
    throw error;
  }

  await audit.record(req.actor, {
    action: "account_requested",
    entity: "account_requests",
    entityId: row.id,
    summary: `${input.givenNames} ${input.surname} (${input.email}) asked for a ${kind} account.`,
  });

  created(res, {
    id: row.id,
    kind: row.kind,
    status: "pending",
    message:
      kind === "student"
        ? "Thank you. The registry will review this and contact you."
        : "Thank you. An administrator has to approve this before you can sign in.",
  });
}

export async function registerStudent(req: Request, res: Response) {
  await submit(req, res, "student", req.body as z.infer<typeof studentBody>);
}

export async function registerLecturer(req: Request, res: Response) {
  await submit(req, res, "lecturer", req.body as z.infer<typeof staffBody>);
}

export async function registerAdmin(req: Request, res: Response) {
  await submit(req, res, "admin", req.body as z.infer<typeof staffBody>);
}
