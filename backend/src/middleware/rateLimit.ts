import type { Request, RequestHandler } from "express";

import { rateLimited } from "../lib/errors.js";

/**
 * A small fixed-window limiter for the endpoints a stranger can reach:
 * booking, and starting a sign-in.
 *
 * In memory, so it is per-process. On a single host that is the whole story;
 * across several it means the real limit is the configured one times the
 * number of instances. That is accepted for now and written down rather than
 * discovered later — the fix is a shared counter in Redis, and REDIS_URL is
 * already in .env.example for when WIPEG needs it.
 *
 * This stops casual abuse of a public form. It is not protection against a
 * determined attacker, which is what Turnstile on the form is for.
 */

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Map<string, Window>>();

function sweep(windows: Map<string, Window>, now: number) {
  // Called on write, so the map cannot grow without bound from one-off IPs.
  if (windows.size < 5_000) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

function clientKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (
    raw?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown"
  );
}

export function rateLimit(options: {
  name: string;
  max: number;
  windowSeconds: number;
  message?: string;
}): RequestHandler {
  const windows = buckets.get(options.name) ?? new Map<string, Window>();
  buckets.set(options.name, windows);

  return (req, res, next) => {
    const now = Date.now();
    const key = clientKey(req);
    const existing = windows.get(key);

    if (!existing || existing.resetAt <= now) {
      sweep(windows, now);
      windows.set(key, {
        count: 1,
        resetAt: now + options.windowSeconds * 1000,
      });
      next();
      return;
    }

    existing.count += 1;

    if (existing.count > options.max) {
      const seconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader("retry-after", String(seconds));
      next(
        rateLimited(
          options.message ??
            `Too many attempts. Please wait ${seconds} seconds and try again.`,
        ),
      );
      return;
    }

    next();
  };
}
