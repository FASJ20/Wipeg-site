import type { Request, Response } from "express";
import { z } from "zod";

import { notFound } from "../lib/errors.js";
import { ok } from "../lib/http.js";
import { queryOf } from "../middleware/validate.js";
import * as catalogue from "../models/catalogue.js";

/**
 * The public catalogue. No sign-in, nothing about any person, safe to cache.
 *
 * This is what lets the website stop hard-coding WIPEG's departments in
 * src/data/site.ts and read them from the one place they are maintained.
 */

export const specialisationsQuery = z.object({
  department: z.string().trim().min(1).max(80).optional(),
});

export async function listCampuses(_req: Request, res: Response): Promise<void> {
  ok(res, await catalogue.listCampuses());
}

export async function listDepartments(
  _req: Request,
  res: Response,
): Promise<void> {
  ok(res, await catalogue.listDepartments());
}

export async function listSpecialisations(
  req: Request,
  res: Response,
): Promise<void> {
  const { department } = queryOf<z.infer<typeof specialisationsQuery>>(req);
  ok(res, await catalogue.listSpecialisations(department ?? null));
}

export async function listLevels(_req: Request, res: Response): Promise<void> {
  ok(res, await catalogue.listLevels());
}

/**
 * One department with its specialisations, for a programme page.
 *
 * Express 5 types a route parameter as `string | string[]`, because a
 * repeated name in the pattern yields an array. `:slug` appears once here,
 * so the array case cannot arise — but it is narrowed rather than asserted,
 * so a later change to the route pattern fails loudly instead of quietly
 * passing an array into SQL.
 */
export async function departmentDetail(
  req: Request,
  res: Response,
): Promise<void> {
  const raw = req.params.slug;
  const slug = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");

  const department = await catalogue.departmentBySlug(slug);
  if (!department) throw notFound("That department");

  ok(res, {
    ...department,
    specialisations: await catalogue.listSpecialisations(slug),
  });
}

/** Everything at once, for the website's first paint. */
export async function everything(_req: Request, res: Response): Promise<void> {
  const [campuses, departments, specialisations, levels] = await Promise.all([
    catalogue.listCampuses(),
    catalogue.listDepartments(),
    catalogue.listSpecialisations(null),
    catalogue.listLevels(),
  ]);
  ok(res, { campuses, departments, specialisations, levels });
}
