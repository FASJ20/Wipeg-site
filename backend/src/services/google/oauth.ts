import { OAuth2Client } from "google-auth-library";

import { requireGoogleOAuth } from "../../lib/env.js";
import { notAuthorised, upstreamFailed } from "../../lib/errors.js";

/**
 * Signing in with Google, for staff and students on the WIPEG Workspace.
 *
 * There is no password in this system. Nobody can reset one, nobody can reuse
 * one from elsewhere, and leaving WIPEG — which means the Workspace account
 * being suspended — ends portal access with no second step to forget.
 */

const SCOPES = ["openid", "email", "profile"];

function client(): OAuth2Client {
  const config = requireGoogleOAuth();
  return new OAuth2Client({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
  });
}

/** Where to send the browser to start the sign-in. */
export function signInUrl(state: string): string {
  const config = requireGoogleOAuth();
  return client().generateAuthUrl({
    scope: SCOPES,
    state,
    // A hint to Google's UI to pre-filter the account chooser. It is ONLY a
    // hint: anyone can strip it from the URL, which is why the domain is
    // checked again on the verified email below.
    hd: config.workspaceDomain,
    prompt: "select_account",
  });
}

export type GoogleIdentity = {
  /** Google's stable id for the account. Survives a rename; the email does not. */
  googleSub: string;
  email: string;
  givenName: string | null;
  familyName: string | null;
  picture: string | null;
};

/**
 * Exchange the callback code for a verified identity.
 *
 * Two checks matter here and neither is optional:
 *   1. the id token's signature is verified against Google's keys, by
 *      `verifyIdToken` — this is what makes the claims trustworthy at all;
 *   2. the *verified* email's domain is compared to the Workspace domain.
 *      The `hd=` parameter on the sign-in URL does not survive a hostile
 *      caller, so without this a personal Gmail account would be accepted.
 */
export async function exchangeCodeForIdentity(
  code: string,
): Promise<GoogleIdentity> {
  const config = requireGoogleOAuth();
  const oauth = client();

  let idToken: string | undefined;
  try {
    const { tokens } = await oauth.getToken(code);
    idToken = tokens.id_token ?? undefined;
  } catch (error) {
    throw upstreamFailed("Google sign-in", error);
  }

  if (!idToken) {
    throw upstreamFailed("Google sign-in", "no id_token in the token response");
  }

  let payload;
  try {
    const ticket = await oauth.verifyIdToken({
      idToken,
      audience: config.clientId,
    });
    payload = ticket.getPayload();
  } catch (error) {
    throw upstreamFailed("Google sign-in", error);
  }

  if (!payload?.email || payload.email_verified !== true) {
    throw notAuthorised("Google did not confirm that email address.");
  }

  const domain = payload.email.split("@")[1]?.toLowerCase();
  if (domain !== config.workspaceDomain.toLowerCase()) {
    throw notAuthorised(
      `Sign in with your @${config.workspaceDomain} account. Personal accounts cannot be used.`,
    );
  }

  return {
    googleSub: payload.sub,
    email: payload.email.toLowerCase(),
    givenName: payload.given_name ?? null,
    familyName: payload.family_name ?? null,
    picture: payload.picture ?? null,
  };
}
