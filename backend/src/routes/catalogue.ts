import { Router } from "express";

import { asyncHandler } from "../lib/http.js";
import { validateQuery } from "../middleware/validate.js";
import * as catalogue from "../controllers/catalogue.js";

/**
 * What WIPEG offers. Public, every route — no sign-in, and nothing here is
 * about any person, which is what makes it safe to open to the world.
 */
export const catalogueRoutes: Router = Router();

catalogueRoutes.get("/", asyncHandler(catalogue.everything));
catalogueRoutes.get("/campuses", asyncHandler(catalogue.listCampuses));
catalogueRoutes.get("/departments", asyncHandler(catalogue.listDepartments));
catalogueRoutes.get(
  "/departments/:slug",
  asyncHandler(catalogue.departmentDetail),
);
catalogueRoutes.get(
  "/specialisations",
  validateQuery(catalogue.specialisationsQuery),
  asyncHandler(catalogue.listSpecialisations),
);
catalogueRoutes.get("/levels", asyncHandler(catalogue.listLevels));
