import { JWT } from "google-auth-library";

import { requireServiceAccount } from "../../lib/env.js";
import { upstreamFailed } from "../../lib/errors.js";

/**
 * The service account, which acts as a real WIPEG admin through domain-wide
 * delegation. This is how the backend writes to the shared calendar and
 * creates Workspace accounts.
 *
 * It is the most dangerous credential in the system: inside the Workspace it
 * can act as anybody. Two rules follow, and both are enforced here rather
 * than left to whoever writes the next feature.
 *
 *   1. Scopes are passed in per client and listed in SCOPES below. Nothing
 *      asks for a scope it does not use, so a mistake in the calendar code
 *      cannot read anyone's mail.
 *   2. The key is never logged, never returned and never written to disk.
 */

export const SCOPES = {
  /** Read free/busy and create events on the shared booking calendar. */
  calendar: ["https://www.googleapis.com/auth/calendar.events"],
  /** Create and suspend user accounts. Nothing else in the directory. */
  directory: ["https://www.googleapis.com/auth/admin.directory.user"],
} as const;

const clients = new Map<string, JWT>();

function clientFor(scopes: readonly string[]): JWT {
  const key = scopes.join(" ");
  const existing = clients.get(key);
  if (existing) return existing;

  const config = requireServiceAccount();
  const jwt = new JWT({
    email: config.credentials.client_email,
    key: config.credentials.private_key,
    scopes: [...scopes],
    // Domain-wide delegation: act as this admin. Google refuses the directory
    // API outright for a service account that is not impersonating someone.
    subject: config.impersonatedAdmin,
  });

  clients.set(key, jwt);
  return jwt;
}

/**
 * Call a Google REST endpoint as the impersonated admin.
 *
 * Written against fetch rather than the `googleapis` package on purpose: that
 * package is tens of megabytes for the handful of calls used here, and the
 * request bodies below are easier to audit when they are visible.
 */
export async function googleFetch<T>(
  scopes: readonly string[],
  url: string,
  init: { method?: string; body?: unknown; service: string } ,
): Promise<T> {
  const jwt = clientFor(scopes);

  let accessToken: string | null | undefined;
  try {
    accessToken = (await jwt.getAccessToken()).token;
  } catch (error) {
    throw upstreamFailed(init.service, error);
  }
  if (!accessToken) throw upstreamFailed(init.service, "no access token");

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch (error) {
    throw upstreamFailed(init.service, error);
  }

  if (!response.ok) {
    // Read the body for the log, but never put it in the thrown message —
    // Google error bodies echo back request content.
    const detail = await response.text().catch(() => "");
    throw upstreamFailed(init.service, {
      status: response.status,
      detail: detail.slice(0, 500),
    });
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Distinguishes "already exists" from a real failure, for idempotent writes. */
export async function googleFetchRaw(
  scopes: readonly string[],
  url: string,
  init: { method?: string; body?: unknown; service: string },
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const jwt = clientFor(scopes);
  const accessToken = (await jwt.getAccessToken().catch(() => ({ token: null })))
    .token;
  if (!accessToken) throw upstreamFailed(init.service, "no access token");

  const response = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  }).catch((error) => {
    throw upstreamFailed(init.service, error);
  });

  const json = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, json };
}
