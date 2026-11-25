import type { RequestHandler } from "express";
import { ZodError, type ZodTypeAny, type z } from "zod";

import { AppError, type ErrorDetail } from "../lib/errors.js";

/**
 * One zod schema per endpoint, checked before anything reaches a model.
 *
 * The parsed value replaces the raw one, so a controller downstream is
 * working with trimmed, coerced, known-shaped data and cannot accidentally
 * read a field the schema did not allow.
 */

function toDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "(body)",
    message: issue.message,
  }));
}

export function validateBody<S extends ZodTypeAny>(schema: S): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(
        new AppError("validation_failed", "Some details need correcting.", {
          details: toDetails(result.error),
        }),
      );
      return;
    }
    req.body = result.data as z.infer<S>;
    next();
  };
}

export function validateQuery<S extends ZodTypeAny>(schema: S): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(
        new AppError("validation_failed", "Check the search options.", {
          details: toDetails(result.error),
        }),
      );
      return;
    }
    // Express 5 makes req.query a getter, so it is replaced rather than
    // assigned through. The parsed value is stashed for the controller.
    Object.defineProperty(req, "validatedQuery", {
      value: result.data,
      writable: false,
      enumerable: false,
      configurable: true,
    });
    next();
  };
}

/** Reads what `validateQuery` stored. Typed by the caller's own schema. */
export function queryOf<T>(req: { validatedQuery?: unknown }): T {
  return req.validatedQuery as T;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      validatedQuery?: unknown;
    }
  }
}
