import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 5 forwards a rejected promise to the error middleware on its own,
 * so this wrapper is not strictly required. It is kept because it is a single
 * obvious place to see that a handler is async, and because removing it would
 * silently change behaviour if the project is ever pinned back to Express 4.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

/** 200 with a JSON body. */
export function ok(res: Response, data: unknown): void {
  res.status(200).json({ data });
}

/** 201 with a JSON body, for a write that produced something new. */
export function created(res: Response, data: unknown): void {
  res.status(201).json({ data });
}

/** 204, for a write with nothing worth returning. */
export function noContent(res: Response): void {
  res.status(204).end();
}

/**
 * A page of results. `nextCursor` is null on the last page.
 *
 * Cursor rather than offset: a registry clerk paging through students while
 * somebody else enrols one should not see a row twice or miss one, which is
 * exactly what OFFSET does when the underlying set shifts.
 */
export function page(
  res: Response,
  rows: unknown[],
  nextCursor: string | null,
): void {
  res.status(200).json({ data: rows, nextCursor });
}
