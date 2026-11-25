import { env, isProduction } from "./env.js";

/**
 * Structured logging, with one hard rule: secrets never reach the output.
 *
 * The backend handles a database password, a Google service-account key that
 * can act as any user in the Workspace, a WhatsApp token and session cookies.
 * Any of those landing in a log file is a real incident, and the usual way it
 * happens is somebody logging a whole request or a whole error object. So the
 * redaction happens here, once, rather than being remembered at each call.
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL: Level = isProduction ? "info" : "debug";

/** Key names whose values are replaced wholesale, matched case-insensitively. */
const SECRET_KEY = /(secret|token|password|passwd|authorization|cookie|private_key|api[_-]?key|credential)/i;

/** Values that look like a secret even under an innocent key name. */
const SECRET_VALUE: RegExp[] = [
  /postgres(ql)?:\/\/[^\s]+/i, // connection strings, password and all
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bya29\.[A-Za-z0-9_-]+/, // Google OAuth access tokens
  /\bEAA[A-Za-z0-9]{20,}/, // Meta/WhatsApp tokens
];

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[too deep]";

  if (typeof value === "string") {
    let out = value;
    for (const pattern of SECRET_VALUE) out = out.replace(pattern, "[redacted]");
    return out;
  }

  if (value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redact(value.message, depth + 1),
      stack: isProduction ? undefined : value.stack,
    };
  }

  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY.test(key) ? "[redacted]" : redact(inner, depth + 1);
  }
  return out;
}

function emit(level: Level, message: string, context?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;

  const line = {
    at: new Date().toISOString(),
    level,
    msg: message,
    ...(context ? (redact(context) as Record<string, unknown>) : {}),
  };

  const text = isProduction
    ? JSON.stringify(line)
    : `${line.at}  ${level.toUpperCase().padEnd(5)} ${message}` +
      (context ? `  ${JSON.stringify(redact(context))}` : "");

  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) =>
    emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) =>
    emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) =>
    emit("error", message, context),
};

logger.debug("logger ready", { nodeEnv: env.NODE_ENV, minLevel: MIN_LEVEL });
