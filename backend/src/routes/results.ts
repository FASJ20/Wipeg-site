import { Router } from "express";

import { asyncHandler } from "../lib/http.js";
import { requireAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import * as results from "../controllers/results.js";

/**
 * The registry's results desk. Admin only, every route.
 *
 * Entering marks is the lecturer's job and lives in routes/teaching.ts.
 * This is the second pair of eyes: read what was submitted, then release it
 * or send it back.
 */
export const resultsRoutes: Router = Router();

resultsRoutes.use(requireAdmin);

resultsRoutes.get("/pending", asyncHandler(results.queue));
resultsRoutes.get("/offerings/:id", asyncHandler(results.review));

resultsRoutes.post(
  "/offerings/:id/publish",
  validateBody(results.publishBody),
  asyncHandler(results.publish),
);
resultsRoutes.post(
  "/offerings/:id/return",
  validateBody(results.returnBody),
  asyncHandler(results.returnToLecturer),
);
