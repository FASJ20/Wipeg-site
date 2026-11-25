import "dotenv/config";
import { z } from "zod";

/**
 * Every setting the backend reads, validated once at boot.
 *
 * The point of failing here is that a missing SESSION_SECRET should stop the
 * process on line one, not surface as a confusing 500 three weeks later when
 * somebody finally tries to sign in.
 *
 * Google and WhatsApp settings are optional so the server still starts on a
 * laptop with nothing configured. The feature that needs one asks for it
 * through `requireGoogle()` below and fails loudly at that point instead.
 */

const trimmed = z.string().transform((v) => v.trim());
const nonEmpty = trimmed.pipe(z.string().min(1));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(6008),

  /** Where the website is served from. Used for CORS and for building links. */
  PUBLIC_SITE_ORIGIN: nonEmpty.default("http://localhost:6007"),

  DATABASE_URL: nonEmpty,

  /** 32+ random bytes, base64. `openssl rand -base64 48`. */
  SESSION_SECRET: nonEmpty.pipe(z.string().min(32)),
  SESSION_HOURS: z.coerce.number().int().positive().max(24 * 14).default(12),

  // ----------------------------------------------------------- Google OAuth
  GOOGLE_OAUTH_CLIENT_ID: trimmed.optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: trimmed.optional(),
  GOOGLE_OAUTH_REDIRECT_URI: trimmed.optional(),

  /**
   * Only accounts on this domain may sign in. Pinned as `hd=` on the Google
   * sign-in URL AND checked again on the verified email when it comes back,
   * because the first one is only a UI hint and anyone can edit a URL.
   */
  GOOGLE_WORKSPACE_DOMAIN: trimmed.optional(),

  // -------------------------------- Google service account (Calendar, Admin)
  GOOGLE_SERVICE_ACCOUNT_JSON: trimmed.optional(),
  GOOGLE_IMPERSONATED_ADMIN: trimmed.optional(),
  GOOGLE_CALENDAR_ID: trimmed.optional(),

  // -------------------------------------------------------------- Provisioning
  /**
   * How a new Workspace address is built. `{given}` and `{surname}` are
   * lowercased and stripped of accents and spaces; `{matricule}` is as stored.
   * Changing this later does not rename anybody, so decide once.
   */
  WORKSPACE_EMAIL_FORMAT: nonEmpty.default("{given}.{surname}"),
  WORKSPACE_STUDENT_OU: nonEmpty.default("/Students"),
  WORKSPACE_STAFF_OU: nonEmpty.default("/Staff"),

  // ------------------------------------------------------------ Call booking
  BOOKING_TIMEZONE: nonEmpty.default("Africa/Douala"),
  BOOKING_SLOT_MINUTES: z.coerce.number().int().positive().default(30),
  BOOKING_OPEN_TIME: z.string().regex(/^\d{2}:\d{2}$/).default("08:00"),
  BOOKING_CLOSE_TIME: z.string().regex(/^\d{2}:\d{2}$/).default("16:00"),
  /** 1 = Monday … 7 = Sunday. */
  BOOKING_DAYS: nonEmpty.default("1,2,3,4,5,6"),
  BOOKING_DAYS_AHEAD: z.coerce.number().int().positive().default(14),
  BOOKING_MIN_NOTICE_MINUTES: z.coerce.number().int().nonnegative().default(120),

  /** Shown to the visitor, and written as the event location for onsite calls. */
  BOOKING_ONSITE_ADDRESS: nonEmpty.default(
    "WIPEG Garoua Campus, Plateau, behind Collège de l'Espoir, Garoua",
  ),

  // ------------------------------------------------------------------- Jobs
  CRON_SECRET: trimmed.optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map(
    (i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`,
  );
  // Deliberately not the logger: the logger reads config, and config is what
  // just failed.
  console.error(
    `\nThe backend cannot start. Fix these in backend/.env:\n\n${lines.join("\n")}\n`,
  );
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

/** Days of the week bookings are offered on, as 1 = Monday … 7 = Sunday. */
export const bookingDays: ReadonlySet<number> = new Set(
  env.BOOKING_DAYS.split(",")
    .map((d) => Number.parseInt(d.trim(), 10))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7),
);

type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  workspaceDomain: string;
};

/**
 * Google sign-in config, or a clear error naming what is missing.
 *
 * Called by the auth routes rather than at boot so that `npm run dev` works
 * for somebody building the catalogue endpoints who has no Google project yet.
 */
export function requireGoogleOAuth(): GoogleConfig {
  const missing: string[] = [];
  if (!env.GOOGLE_OAUTH_CLIENT_ID) missing.push("GOOGLE_OAUTH_CLIENT_ID");
  if (!env.GOOGLE_OAUTH_CLIENT_SECRET) missing.push("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!env.GOOGLE_OAUTH_REDIRECT_URI) missing.push("GOOGLE_OAUTH_REDIRECT_URI");
  if (!env.GOOGLE_WORKSPACE_DOMAIN) missing.push("GOOGLE_WORKSPACE_DOMAIN");

  if (missing.length > 0) {
    throw new Error(
      `Google sign-in is not configured. Missing in backend/.env: ${missing.join(", ")}`,
    );
  }

  return {
    clientId: env.GOOGLE_OAUTH_CLIENT_ID as string,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET as string,
    redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI as string,
    workspaceDomain: env.GOOGLE_WORKSPACE_DOMAIN as string,
  };
}

type ServiceAccountConfig = {
  credentials: { client_email: string; private_key: string };
  impersonatedAdmin: string;
  workspaceDomain: string;
};

/**
 * The service-account key, parsed.
 *
 * This key can act as any user in the Workspace. It is read from the
 * environment and never written anywhere, never logged, and never returned
 * in a response.
 */
export function requireServiceAccount(): ServiceAccountConfig {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is not set. Calendar and account provisioning need it.",
    );
  }
  if (!env.GOOGLE_IMPERSONATED_ADMIN) {
    throw new Error(
      "GOOGLE_IMPERSONATED_ADMIN is not set. The service account has to act as a real admin.",
    );
  }
  if (!env.GOOGLE_WORKSPACE_DOMAIN) {
    throw new Error("GOOGLE_WORKSPACE_DOMAIN is not set.");
  }

  let parsedKey: unknown;
  try {
    parsedKey = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch {
    // Never echo the value back, even partially.
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }

  const shape = z.object({
    client_email: z.string().email(),
    private_key: z.string().min(1),
  });
  const key = shape.safeParse(parsedKey);
  if (!key.success) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key.",
    );
  }

  return {
    credentials: {
      client_email: key.data.client_email,
      // Hosting panels commonly store the key with literal \n sequences.
      private_key: key.data.private_key.replace(/\\n/g, "\n"),
    },
    impersonatedAdmin: env.GOOGLE_IMPERSONATED_ADMIN,
    workspaceDomain: env.GOOGLE_WORKSPACE_DOMAIN,
  };
}

export function requireCalendarId(): string {
  if (!env.GOOGLE_CALENDAR_ID) {
    throw new Error(
      "GOOGLE_CALENDAR_ID is not set. Booking needs the shared WIPEG calendar.",
    );
  }
  return env.GOOGLE_CALENDAR_ID;
}
