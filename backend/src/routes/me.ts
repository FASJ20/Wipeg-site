import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import * as me from "../controllers/me.js";

/**
 * The signed-in person's own view. Everything here is about the caller and
 * nobody else — there is no space in any of these addresses for somebody
 * else's id.
 */
export const meRoutes: Router = Router();

meRoutes.get("/", requireAuth, me.whoAmI);
