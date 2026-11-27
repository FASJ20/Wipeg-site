import { Router } from "express";

import { accountRequestRoutes } from "./accountRequests.js";
import { auditRoutes } from "./audit.js";
import { authRoutes } from "./auth.js";
import { bookingRoutes } from "./booking.js";
import { catalogueRoutes, } from "./catalogue.js";
import { classroomJobRoutes, classroomRoutes } from "./classroom.js";
import { healthRoutes } from "./health.js";
import { meRoutes } from "./me.js";
import { studentRoutes } from "./student.js";
import { studentRecordRoutes } from "./students.js";
import { staffRoutes } from "./staff.js";
import { teachingRoutes } from "./teaching.js";
import { resultsRoutes } from "./results.js";

/**
 * Where each group of addresses lives. This file mounts and nothing else —
 * open the feature's own file to see its routes and who may call them.
 *
 *   /api/health            is it up
 *   /api/auth              register, sign in, sign out
 *   /api/me                the signed-in person's own view, and the student portal
 *   /api/students          staff: student records (admin edits, lecturer reads)
 *   /api/staff             admin: staff records and admin grants
 *   /api/teaching          lecturer: my subjects, marks, registers
 *   /api/results           admin: reviewing and publishing marks
 *   /api/account-requests  admin: approving who gets in
 *   /api/catalogue         public: campuses, departments, programmes
 *   /api/booking           public: booking a call
 *   /api/classroom         admin: Google Classroom
 *   /api/audit             admin: who did what
 *   /api/jobs              the scheduler, carrying CRON_SECRET
 */
export const router: Router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/me", meRoutes);
// The student portal lives under /me too: everything here is about the
// caller and nobody else.
router.use("/me", studentRoutes);
router.use("/students", studentRecordRoutes);
router.use("/staff", staffRoutes);
router.use("/teaching", teachingRoutes);
router.use("/results", resultsRoutes);
router.use("/account-requests", accountRequestRoutes);
router.use("/catalogue", catalogueRoutes);
router.use("/booking", bookingRoutes);
router.use("/classroom", classroomRoutes);
router.use("/audit", auditRoutes);
router.use("/jobs", classroomJobRoutes);
