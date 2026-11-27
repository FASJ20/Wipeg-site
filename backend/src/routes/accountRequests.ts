import { Router } from "express";

import { asyncHandler } from "../lib/http.js";
import { requireAdmin } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import * as review from "../controllers/accountRequests.js";

/**
 * Deciding who gets in. Admin only, every route.
 *
 * This is where access is actually granted, which is why it is its own file
 * rather than tucked in beside registration: anyone can register, and only
 * an admin can turn that into an account.
 */
export const accountRequestRoutes: Router = Router();

accountRequestRoutes.get(
  "/",
  requireAdmin,
  validateQuery(review.queueQuery),
  asyncHandler(review.listQueue),
);

accountRequestRoutes.post(
  "/:id/decide",
  requireAdmin,
  validateBody(review.decisionBody),
  asyncHandler(review.decide),
);
