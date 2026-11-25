import { createApp } from "./app.js";
import { closeDatabase, pingDatabase } from "./lib/db.js";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";

/**
 * Starts the server, and stops it properly.
 *
 * The database is checked before the port is opened: a server that accepts
 * requests it cannot answer is harder to diagnose than one that refuses to
 * start and says why.
 */
async function main(): Promise<void> {
  try {
    await pingDatabase();
    logger.info("database reachable");
  } catch (error) {
    logger.error(
      "cannot reach the database — check DATABASE_URL in backend/.env",
      { error },
    );
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`WIPEG API listening on http://localhost:${env.PORT}`, {
      environment: env.NODE_ENV,
      site: env.PUBLIC_SITE_ORIGIN,
    });
  });

  // Finish in-flight requests before exiting, so a deploy does not cut a
  // receipt write in half.
  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await closeDatabase().catch(() => undefined);
      process.exit(0);
    });
    setTimeout(() => {
      logger.warn("shutdown timed out, exiting anyway");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  logger.error("failed to start", { error });
  process.exit(1);
});
