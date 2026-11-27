import { Router } from "express";

import { asyncHandler } from "../lib/http.js";
import { requireAdmin } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import * as staff from "../controllers/staff.js";

/**
 * Staff records. Admin only, every route.
 *
 * No DELETE, for the same reason as students: a lecturer who taught a class
 * three years ago is named on those results. `retire` marks them former and
 * revokes any admin grant in the same breath.
 */
export const staffRoutes: Router = Router();

staffRoutes.use(requireAdmin);

staffRoutes.get(
  "/",
  validateQuery(staff.listQuery),
  asyncHandler(staff.list),
);
staffRoutes.get("/:id", asyncHandler(staff.detail));
staffRoutes.patch(
  "/:id",
  validateBody(staff.patchBody),
  asyncHandler(staff.update),
);
staffRoutes.post(
  "/:id/retire",
  validateBody(staff.retireBody),
  asyncHandler(staff.retire),
);

// The two most consequential actions in the system. Both refuse to leave
// WIPEG without an administrator.
staffRoutes.post(
  "/:id/grant-admin",
  validateBody(staff.grantBody),
  asyncHandler(staff.grantAdmin),
);
staffRoutes.post(
  "/:id/revoke-admin",
  validateBody(staff.grantBody),
  asyncHandler(staff.revokeAdmin),
);
