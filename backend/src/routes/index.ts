import { Router } from "express";
import { z } from "zod";

import { pingDatabase } from "../lib/db.js";
import { env } from "../lib/env.js";
import { asyncHandler, ok } from "../lib/http.js";
import {
  requireAdmin,
  requireAuth,
  requireCronSecret,
} from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { queryOf, validateBody, validateQuery } from "../middleware/validate.js";
import * as audit from "../models/auditLog.js";
import * as authController from "../controllers/auth.js";
import * as bookingController from "../controllers/booking.js";
import * as catalogueController from "../controllers/catalogue.js";
import * as classroomController from "../controllers/classroom.js";
import * as meController from "../controllers/me.js";

/**
 * Every route in one file, so "who can call this?" is one screen of reading.
 *
 * The guard always comes before the validator, and the validator before the
 * controller. That order matters: an unauthorised caller should be refused
 * before the server spends anything parsing what they sent.
 */

export const router: Router = Router();

// --------------------------------------------------------------- health
// No guard. Used by the host's uptime check, so it must answer while the
// database is down — it reports that rather than failing to respond.
router.get(
  "/health",
  asyncHandler(async (_req, res) => {
    let database: "up" | "down" = "up";
    try {
      await pingDatabase();
    } catch {
      database = "down";
    }
    res.status(database === "up" ? 200 : 503).json({
      data: {
        status: database === "up" ? "ok" : "degraded",
        database,
        environment: env.NODE_ENV,
        at: new Date().toISOString(),
      },
    });
  }),
);

// ------------------------------------------------------------ signing in
router.get(
  "/auth/google",
  rateLimit({ name: "sign-in", max: 20, windowSeconds: 300 }),
  authController.start,
);
router.get("/auth/google/callback", asyncHandler(authController.callback));
router.post("/auth/sign-out", authController.signOut);

// ------------------------------------------------------------------- me
router.get("/me", requireAuth, meController.whoAmI);

// ------------------------------------------------------- public catalogue
router.get("/catalogue", asyncHandler(catalogueController.everything));
router.get("/catalogue/campuses", asyncHandler(catalogueController.listCampuses));
router.get(
  "/catalogue/departments",
  asyncHandler(catalogueController.listDepartments),
);
router.get(
  "/catalogue/departments/:slug",
  asyncHandler(catalogueController.departmentDetail),
);
router.get(
  "/catalogue/specialisations",
  validateQuery(catalogueController.specialisationsQuery),
  asyncHandler(catalogueController.listSpecialisations),
);
router.get("/catalogue/levels", asyncHandler(catalogueController.listLevels));

// --------------------------------------------------------- booking a call
// Public, so both are rate limited. The write is limited harder than the
// read: browsing slots is normal, booking six times in a minute is not.
router.get(
  "/booking/slots",
  rateLimit({ name: "booking-slots", max: 60, windowSeconds: 60 }),
  validateQuery(bookingController.slotsQuery),
  asyncHandler(bookingController.slots),
);
router.post(
  "/booking",
  rateLimit({
    name: "booking-create",
    max: 5,
    windowSeconds: 3600,
    message: "You have booked several calls already. Please phone the campus.",
  }),
  validateBody(bookingController.bookingBody),
  asyncHandler(bookingController.create),
);

// ------------------------------------------------- Google Classroom sync
// Two doors onto the same function. An admin presses the button after
// enrolling somebody; the scheduler calls the other one hourly so nobody has
// to remember. Both are safe to run repeatedly.
router.post(
  "/classroom/sync",
  requireAdmin,
  validateBody(classroomController.syncBody),
  asyncHandler(classroomController.sync),
);
router.post(
  "/jobs/classroom-sync",
  requireCronSecret,
  validateBody(classroomController.syncBody),
  asyncHandler(classroomController.sync),
);

// ------------------------------------------------------------- audit log
// Admin only. With one Admin role, this is the control that replaces
// separation of duties, so it must be readable by the people it watches.
const auditQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.coerce.number().int().positive().optional(),
  entity: z.string().trim().max(80).optional(),
});

router.get(
  "/audit",
  requireAdmin,
  validateQuery(auditQuery),
  asyncHandler(async (req, res) => {
    const options = queryOf<z.infer<typeof auditQuery>>(req);
    const rows = await audit.list({
      limit: options.limit,
      before: options.before ?? null,
      entity: options.entity ?? null,
    });
    ok(res, rows);
  }),
);
