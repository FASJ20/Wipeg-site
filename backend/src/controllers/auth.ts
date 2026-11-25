import type { Request, Response } from "express";

import { env } from "../lib/env.js";
import { notAuthorised, badRequest } from "../lib/errors.js";
import { ok } from "../lib/http.js";
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
  findBySchoolEmail,
  linkGoogleAccount,
  primaryRole,
  stampSignIn,
} from "../models/identity.js";
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
