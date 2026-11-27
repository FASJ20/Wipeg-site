import { Router } from "express";
import { z } from "zod";

import { asyncHandler, ok } from "../lib/http.js";
import { requireAdmin } from "../middleware/auth.js";
import { queryOf, validateQuery } from "../middleware/validate.js";
import * as audit from "../models/auditLog.js";

/**
 * Who did what. Admin only.
 *
 * WIPEG runs a single Admin role, so whoever can record a receipt can also
 * change a matricule. This log is the control that replaces separation of
 * duties — which means it has to be readable by the people it watches.
 */
export const auditRoutes: Router = Router();

const auditQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.coerce.number().int().positive().optional(),
  entity: z.string().trim().max(80).optional(),
});

auditRoutes.get(
  "/",
  requireAdmin,
  validateQuery(auditQuery),
  asyncHandler(async (req, res) => {
    const options = queryOf<z.infer<typeof auditQuery>>(req);
    ok(
      res,
      await audit.list({
        limit: options.limit,
        before: options.before ?? null,
        entity: options.entity ?? null,
      }),
    );
  }),
);
