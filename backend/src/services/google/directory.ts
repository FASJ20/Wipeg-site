import { randomBytes } from "node:crypto";

import { env, requireServiceAccount } from "../../lib/env.js";
import { conflict, upstreamFailed } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { googleFetch, googleFetchRaw, SCOPES } from "./serviceAccount.js";

/**
 * Creating WIPEG Workspace accounts from the backend, so that nobody has to
 * open the Admin console and type a student's name a second time.
 *
 * On the timing, which is worth being exact about: an account CANNOT be
 * created when somebody signs in, because signing in with Google requires the
 * account to exist already. So provisioning happens at the moment WIPEG first
 * commits to the person — enrolment for a student, being added to staff for a
 * lecturer — and by the time they sign in for the first time, the address is
 * waiting for them. From the registry's point of view the effect is the one
 * asked for: nobody creates accounts by hand.
 */

const DIRECTORY_API = "https://admin.googleapis.com/admin/directory/v1";

/** "Ngoè Marie-Claire" -> "ngoe.marie-claire" */
function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip the accents, keep the letters
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export type AccountRequest = {
  givenNames: string;
  surname: string;
  matricule?: string | null;
  kind: "student" | "staff";
  /** Reachable address for handing over the first password. */
  recoveryEmail?: string | null;
  recoveryPhone?: string | null;
};

export type ProvisionedAccount = {
  email: string;
  googleId: string;
  /** Only ever returned at creation. Null when the account already existed. */
  temporaryPassword: string | null;
  alreadyExisted: boolean;
};

function buildLocalPart(request: AccountRequest): string {
  const given = slug(request.givenNames.split(/\s+/)[0] ?? request.givenNames);
  const surname = slug(request.surname);
  const matricule = slug(request.matricule ?? "");

  const local = env.WORKSPACE_EMAIL_FORMAT.replace("{given}", given)
    .replace("{surname}", surname)
    .replace("{matricule}", matricule)
    .replace(/^[.\-]+|[.\-]+$/g, "");

  if (local.length === 0) {
    throw conflict(
      "Cannot build an email address from that name. Check WORKSPACE_EMAIL_FORMAT.",
    );
  }
  // Google's local part limit.
  return local.slice(0, 64);
}

type GoogleUser = { id: string; primaryEmail: string };

async function addressIsFree(email: string): Promise<boolean> {
  const result = await googleFetchRaw(
    SCOPES.directory,
    `${DIRECTORY_API}/users/${encodeURIComponent(email)}`,
    { service: "Google Workspace" },
  );
  if (result.status === 404) return true;
  if (result.ok) return false;
  throw upstreamFailed("Google Workspace", {
    status: result.status,
    json: result.json,
  });
}

/**
 * A password nobody has to read aloud correctly: no ambiguous characters, and
 * long enough that the entropy does not depend on the alphabet being large.
 * Google forces a change on first sign-in anyway (changePasswordAtNextLogin).
 */
function temporaryPassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789"; // no l, o, 0, 1
  const bytes = randomBytes(16);
  let out = "";
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}`;
}

/**
 * Create the Workspace account, or return the one that is already there.
 *
 * Idempotent on purpose. Enrolment can be retried, and a retry must not fail
 * because the account from the first attempt exists — nor create a second one
 * with a `2` on the end.
 */
export async function ensureWorkspaceAccount(
  request: AccountRequest,
): Promise<ProvisionedAccount> {
  const { workspaceDomain } = requireServiceAccount();

  const base = buildLocalPart(request);
  let email = `${base}@${workspaceDomain}`;

  // Two people genuinely can share a name. Suffix rather than refuse.
  let suffix = 1;
  while (!(await addressIsFree(email))) {
    suffix += 1;
    if (suffix > 50) {
      throw conflict(
        `Could not find a free address for ${base}@${workspaceDomain}.`,
      );
    }
    email = `${base}${suffix}@${workspaceDomain}`;
  }

  const password = temporaryPassword();
  const orgUnitPath =
    request.kind === "student"
      ? env.WORKSPACE_STUDENT_OU
      : env.WORKSPACE_STAFF_OU;

  const body: Record<string, unknown> = {
    primaryEmail: email,
    name: { givenName: request.givenNames, familyName: request.surname },
    password,
    changePasswordAtNextLogin: true,
    orgUnitPath,
  };
  if (request.recoveryEmail) body.recoveryEmail = request.recoveryEmail;
  if (request.recoveryPhone) body.recoveryPhone = request.recoveryPhone;

  const result = await googleFetchRaw(
    SCOPES.directory,
    `${DIRECTORY_API}/users`,
    { method: "POST", body, service: "Google Workspace" },
  );

  if (result.status === 409) {
    // Lost a race with another request. Read back what exists.
    const existing = await googleFetch<GoogleUser>(
      SCOPES.directory,
      `${DIRECTORY_API}/users/${encodeURIComponent(email)}`,
      { service: "Google Workspace" },
    );
    return {
      email: existing.primaryEmail,
      googleId: existing.id,
      temporaryPassword: null,
      alreadyExisted: true,
    };
  }

  if (!result.ok) {
    throw upstreamFailed("Google Workspace", {
      status: result.status,
      json: result.json,
    });
  }

  const user = result.json as GoogleUser;

  // The address is safe to log; the password is not, and is not passed here.
  logger.info("workspace account created", {
    email: user.primaryEmail,
    orgUnitPath,
    kind: request.kind,
  });

  return {
    email: user.primaryEmail,
    googleId: user.id,
    temporaryPassword: password,
    alreadyExisted: false,
  };
}

/**
 * Suspend rather than delete. A deleted Google account takes its Drive and
 * its mail with it, and a student who withdraws in October may re-enrol in
 * February. Deletion is a decision for a human in the Admin console.
 */
export async function suspendWorkspaceAccount(email: string): Promise<void> {
  await googleFetch(
    SCOPES.directory,
    `${DIRECTORY_API}/users/${encodeURIComponent(email)}`,
    { method: "PUT", body: { suspended: true }, service: "Google Workspace" },
  );
  logger.info("workspace account suspended", { email });
}
