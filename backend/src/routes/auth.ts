import { Router } from "express";

import { asyncHandler } from "../lib/http.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import * as auth from "../controllers/auth.js";

/**
 * Getting in: registering, signing in, signing out.
 *
 * Two ways to sign in, side by side. Staff on the WIPEG Workspace use
 * Google. A student who has registered but not yet been issued an
 * @wipeg.online address uses an email and password — otherwise they would
 * have nothing to sign in with at all.
 *
 * Registering grants nothing. Each of the three addresses below writes a row
 * to a queue that an admin reviews; see routes/accountRequests.ts.
 */
export const authRoutes: Router = Router();

// ------------------------------------------------------------- with Google
authRoutes.get(
  "/google",
  rateLimit({ name: "sign-in", max: 20, windowSeconds: 300 }),
  auth.start,
);
authRoutes.get("/google/callback", asyncHandler(auth.callback));

// ---------------------------------------------------- with a password
// Limited hard. This is the one endpoint worth guessing at.
authRoutes.post(
  "/login",
  rateLimit({
    name: "password-login",
    max: 10,
    windowSeconds: 900,
    message: "Too many sign-in attempts. Wait fifteen minutes and try again.",
  }),
  validateBody(auth.passwordLoginBody),
  asyncHandler(auth.signInWithPassword),
);

authRoutes.post("/sign-out", auth.signOut);

// ------------------------------------------------------------- registering
// Three addresses so the website can put them behind three separate pages:
// students on the public site, lecturers and admins on their own portals.
const registerLimit = rateLimit({
  name: "register",
  max: 5,
  windowSeconds: 3600,
  message: "Too many registrations from here. Please phone the registry.",
});

authRoutes.post(
  "/register/student",
  registerLimit,
  validateBody(auth.studentBody),
  asyncHandler(auth.registerStudent),
);
authRoutes.post(
  "/register/lecturer",
  registerLimit,
  validateBody(auth.staffBody),
  asyncHandler(auth.registerLecturer),
);
authRoutes.post(
  "/register/admin",
  registerLimit,
  validateBody(auth.staffBody),
  asyncHandler(auth.registerAdmin),
);
