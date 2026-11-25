/**
 * Every error this API returns has one of these codes. The client switches on
 * the code, never on the message — messages are for humans and get reworded.
 */
export const ERROR_CODES = [
  "validation_failed",
  "not_authenticated",
  "not_authorised",
  "not_found",
  "conflict",
  "rate_limited",
  "upstream_failed",
  "internal_error",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const STATUS: Record<ErrorCode, number> = {
  validation_failed: 400,
  not_authenticated: 401,
  not_authorised: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  upstream_failed: 502,
  internal_error: 500,
};

export type ErrorDetail = { field: string; message: string };

/**
 * The only error type the HTTP layer knows how to render.
 *
 * Anything else that reaches the error middleware is a bug, and is reported
 * as `internal_error` with its message swallowed — an unplanned error message
 * is exactly where a connection string or a token tends to leak out.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: ErrorDetail[] | undefined;
  /** Logged, never sent. For "why did this fail" without telling the caller. */
  readonly internal: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options: { details?: ErrorDetail[]; internal?: unknown } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.details = options.details;
    this.internal = options.internal;
  }
}

export const badRequest = (message: string, details?: ErrorDetail[]) =>
  new AppError("validation_failed", message, details ? { details } : {});

export const notAuthenticated = (message = "Sign in to do this.") =>
  new AppError("not_authenticated", message);

export const notAuthorised = (
  message = "Your account does not have access to this.",
) => new AppError("not_authorised", message);

export const notFound = (what = "That record") =>
  new AppError("not_found", `${what} does not exist.`);

export const conflict = (message: string) => new AppError("conflict", message);

export const rateLimited = (message = "Too many attempts. Try again shortly.") =>
  new AppError("rate_limited", message);

/** Google, or anything else outside this system, failed or refused. */
export const upstreamFailed = (service: string, internal?: unknown) =>
  new AppError(
    "upstream_failed",
    `${service} did not respond as expected. Nothing was changed — please try again.`,
    internal === undefined ? {} : { internal },
  );

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
