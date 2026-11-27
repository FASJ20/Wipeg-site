import { Router } from "express";

import { asyncHandler } from "../lib/http.js";
import { requireAdmin, requireCronSecret } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import * as classroom from "../controllers/classroom.js";

/**
 * Google Classroom.
 *
 * Two doors onto the same function: an admin presses the button after
 * enrolling somebody, and the scheduler calls the other hourly so nobody has
 * to remember. One button and one job that behave differently is a bug
 * generator, so they share a controller.
 */
export const classroomRoutes: Router = Router();

classroomRoutes.post(
  "/sync",
  requireAdmin,
  validateBody(classroom.syncBody),
  asyncHandler(classroom.sync),
);

/** The scheduler's door. Mounted under /jobs in routes/index.ts. */
export const classroomJobRoutes: Router = Router();

classroomJobRoutes.post(
  "/classroom-sync",
  requireCronSecret,
  validateBody(classroom.syncBody),
  asyncHandler(classroom.sync),
);
