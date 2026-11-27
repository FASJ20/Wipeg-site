import { Router } from "express";

import { asyncHandler } from "../lib/http.js";
import { requireStudent } from "../middleware/auth.js";
import * as student from "../controllers/student.js";

/**
 * The student portal. Mounted at /api/me/... beside the identity route.
 *
 * `requireStudent` on every one, and not a single address takes a student
 * id — each reads the caller's own id from the session. A student cannot ask
 * for somebody else's record because there is nowhere to put their id.
 */
export const studentRoutes: Router = Router();

studentRoutes.use(requireStudent);

studentRoutes.get("/enrolment", asyncHandler(student.enrolment));
studentRoutes.get("/subjects", asyncHandler(student.subjects));
studentRoutes.get("/results", asyncHandler(student.results));
studentRoutes.get("/attendance", asyncHandler(student.attendance));
studentRoutes.get("/fees", asyncHandler(student.fees));
studentRoutes.get("/documents", asyncHandler(student.documents));
