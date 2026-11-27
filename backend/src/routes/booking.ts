import { Router } from "express";

import { asyncHandler } from "../lib/http.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import * as booking from "../controllers/booking.js";

/**
 * Booking a call. Public, and so rate limited.
 *
 * The write is limited harder than the read: browsing free times is normal,
 * booking six calls in a minute is not.
 */
export const bookingRoutes: Router = Router();

bookingRoutes.get(
  "/slots",
  rateLimit({ name: "booking-slots", max: 60, windowSeconds: 60 }),
  validateQuery(booking.slotsQuery),
  asyncHandler(booking.slots),
);

bookingRoutes.post(
  "/",
  rateLimit({
    name: "booking-create",
    max: 5,
    windowSeconds: 3600,
    message: "You have booked several calls already. Please phone the campus.",
  }),
  validateBody(booking.bookingBody),
  asyncHandler(booking.create),
);
