import { Router } from "express";

import { asyncHandler } from "../lib/http.js";
import { requireStaff } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import * as teaching from "../controllers/teaching.js";

/**
 * The lecturer portal: my subjects, my class lists, my marks, my registers.
 *
 * `requireStaff` is only the outer door. Whether this lecturer teaches THIS
 * subject is checked inside each controller, because it is a database
 * question — a route can only ask "are you staff?".
 *
 * An admin passes `requireStaff` too, and is allowed through the inner check
 * as well. Somebody has to be able to fix a register when a lecturer is away.
 */
export const teachingRoutes: Router = Router();

teachingRoutes.use(requireStaff);

/** What I teach. Mounted at /api/teaching. */
teachingRoutes.get("/", asyncHandler(teaching.myTeaching));

teachingRoutes.get("/offerings/:id/students", asyncHandler(teaching.classList));

// ---------------------------------------------------------------- marks
teachingRoutes.put(
  "/offerings/:id/marks",
  validateBody(teaching.marksBody),
  asyncHandler(teaching.saveMarks),
);
teachingRoutes.post(
  "/offerings/:id/marks/submit",
  asyncHandler(teaching.submitMarks),
);

// ----------------------------------------------------------- attendance
teachingRoutes.get(
  "/offerings/:id/sessions",
  asyncHandler(teaching.listSessions),
);
teachingRoutes.post(
  "/offerings/:id/sessions",
  validateBody(teaching.sessionBody),
  asyncHandler(teaching.createSession),
);
teachingRoutes.get(
  "/sessions/:sessionId/register",
  asyncHandler(teaching.readRegister),
);
teachingRoutes.put(
  "/sessions/:sessionId/register",
  validateBody(teaching.attendanceBody),
  asyncHandler(teaching.markRegister),
);
