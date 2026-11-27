import type { Express } from "express";
import swaggerUi from "swagger-ui-express";

import { isProduction } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import { openApiDocument } from "./openapi.js";

/**
 * Swagger UI at /api/docs, and the raw description at /api/openapi.json.
 *
 * Off in production. The page lists every endpoint and lets anyone press the
 * buttons; in development that is the point, and on a public server it is an
 * invitation. Turn it on there deliberately if WIPEG ever wants it, behind
 * the admin guard.
 *
 * The UI assets are served from this package rather than a CDN, so it works
 * on a slow connection and with no internet at all.
 */
export function mountDocs(app: Express): void {
  if (isProduction) {
    logger.info("API docs are off in production");
    return;
  }

  const document = openApiDocument();

  app.get("/api/openapi.json", (_req, res) => {
    res.json(document);
  });

  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(document, {
      customSiteTitle: "WIPEG API",
      swaggerOptions: {
        // Keeps the session cookie on every "Try it out" call. Without this
        // you sign in and the next request is anonymous again.
        withCredentials: true,
        persistAuthorization: true,
        docExpansion: "list",
        defaultModelsExpandDepth: -1,
      },
    }),
  );

  logger.info("API docs at /api/docs");
}
