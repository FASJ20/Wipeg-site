import { Router } from "express";

import { pingDatabase } from "../lib/db.js";
import { env } from "../lib/env.js";
import { asyncHandler } from "../lib/http.js";

/**
 * Is it up. No guard: the host's uptime check calls this.
 *
 * It must answer even while the database is unreachable — it reports that
 * rather than failing to respond, because "no answer at all" and "database
 * down" are different problems and should look different.
 */
export const healthRoutes: Router = Router();

healthRoutes.get(
  "/",
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
