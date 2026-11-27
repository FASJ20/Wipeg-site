import { Router } from "express";

import { asyncHandler } from "../lib/http.js";
import { requireAdmin, requireStaff } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import * as students from "../controllers/students.js";

/**
 * Student records, for the registry.
 *
 * Admin for everything except reading one student, which a lecturer may also
 * do — but only for a student they actually teach, and only name, matricule
 * and photo. That narrowing happens in the controller, because whether a
 * lecturer teaches a given student is a database question, not something a
 * route can answer.
 *
 * There is no DELETE here on purpose. Removing a student would take their
 * transcript and their payment history with them, so the destructive-looking
 * operation is `withdraw`, which keeps everything.
 */
export const studentRecordRoutes: Router = Router();

studentRecordRoutes.get(
  "/",
  requireAdmin,
  validateQuery(students.listQuery),
  asyncHandler(students.list),
);

// Staff, not admin: a lecturer gets the reduced view of their own students.
studentRecordRoutes.get("/:id", requireStaff, asyncHandler(students.detail));

studentRecordRoutes.patch(
  "/:id",
  requireAdmin,
  validateBody(students.patchBody),
  asyncHandler(students.update),
);

studentRecordRoutes.post(
  "/:id/withdraw",
  requireAdmin,
  validateBody(students.withdrawBody),
  asyncHandler(students.withdraw),
);

studentRecordRoutes.post(
  "/:id/reinstate",
  requireAdmin,
  asyncHandler(students.reinstate),
);
