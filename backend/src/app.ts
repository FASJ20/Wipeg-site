import cookieParser from "cookie-parser";
import express, { type Express } from "express";

import { env, isProduction } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { loadIdentity } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { router } from "./routes/index.js";

/**
 * Assembles the app. Kept separate from `server.ts` so tests can mount it
 * without binding a port.
 */
export function createApp(): Express {
  const app = express();

  // Behind Vercel / a reverse proxy, so X-Forwarded-For can be trusted for
  // the client address. Exactly one hop — anything higher would let a caller
  // spoof their own IP and walk around the rate limiter.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());

  // Browser requests come from the website's origin and carry the session
  // cookie, so the allowed origin has to be exact — `*` is not permitted
  // alongside credentials, and would be wrong here anyway.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && origin === env.PUBLIC_SITE_ORIGIN) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("access-control-allow-credentials", "true");
      res.setHeader("vary", "origin");
      res.setHeader(
        "access-control-allow-headers",
        "content-type, x-cron-secret",
      );
      res.setHeader("access-control-allow-methods", "GET,POST,PATCH,PUT,DELETE");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use((_req, res, next) => {
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("referrer-policy", "same-origin");
    if (isProduction) {
      res.setHeader(
        "strict-transport-security",
        "max-age=31536000; includeSubDomains",
      );
    }
    next();
  });

  // Every request gets an actor, signed in or not, so the audit log and the
  // error log can always name who was asking.
  app.use(loadIdentity);

  app.use("/api", router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  logger.debug("app assembled", { environment: env.NODE_ENV });
  return app;
}
