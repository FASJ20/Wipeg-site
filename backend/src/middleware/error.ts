import type { ErrorRequestHandler, RequestHandler } from "express";

import { AppError, isAppError } from "../lib/errors.js";
import { isProduction } from "../lib/env.js";
import { logger } from "../lib/logger.js";

/**
 * Every error leaves through here, in one shape:
 *
 *   { "error": { "code": "...", "message": "...", "details": [...] } }
 *
 * `code` is what a client branches on. `message` is for a human and may be
 * reworded at any time. `details` is per-field, and only present for a
 * validation failure.
 */

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: "not_found",
      message: `No endpoint at ${req.method} ${req.path}.`,
    },
  });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (isAppError(error)) {
    // Expected failure. Log the internal detail, send the public message.
    const level = error.status >= 500 ? "error" : "warn";
    logger[level]("request failed", {
      code: error.code,
      status: error.status,
      path: `${req.method} ${req.path}`,
      actor: req.actor?.email ?? "anonymous",
      internal: error.internal,
    });

    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  // Anything else is a bug. Its message is swallowed on purpose: unplanned
  // error text is exactly where a connection string or a token leaks out.
  logger.error("unhandled error", {
    path: `${req.method} ${req.path}`,
    actor: req.actor?.email ?? "anonymous",
    error,
  });

  const body: Record<string, unknown> = {
    code: "internal_error",
    message: "Something went wrong at our end. Nothing was changed.",
  };
  if (!isProduction && error instanceof Error) {
    body.developerMessage = error.message;
    body.stack = error.stack;
  }

  res.status(500).json({ error: body });
};

/** Re-exported so routes can throw without importing two modules. */
export { AppError };
