import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";

/**
 * The audit log. Append-only: there is no update and no delete in this file,
 * and there should never be one.
 *
 * WIPEG runs a single Admin role, so whoever can record a receipt can also
 * change a matricule. This table is what replaces separation of duties, and
 * it is only worth anything if writing to it is not optional — so every
 * controller that changes something calls `record` in the same breath.
 */

export type AuditActor = {
  personId: string | null;
  email: string | null;
  role: "admin" | "lecturer" | "student" | "job" | "public";
  ip: string | null;
  userAgent: string | null;
};

export type AuditEntry = {
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
};

/**
 * Write one entry.
 *
 * A failure here is logged and swallowed. That is deliberate and arguable:
 * the alternative is that a broken audit table stops the registry enrolling
 * students. Losing the trail is bad; being unable to run the institute is
 * worse. It is logged at error level so it cannot pass unnoticed.
 */
export async function record(
  actor: AuditActor,
  entry: AuditEntry,
): Promise<void> {
  try {
    await db
      .insertInto("audit_log")
      .values({
        actor_id: actor.personId,
        actor_email: actor.email,
        actor_role: actor.role,
        action: entry.action,
        entity: entry.entity,
        entity_id: entry.entityId ?? null,
        summary: entry.summary,
        before: entry.before === undefined ? null : JSON.stringify(entry.before),
        after: entry.after === undefined ? null : JSON.stringify(entry.after),
        ip: actor.ip,
        user_agent: actor.userAgent?.slice(0, 500) ?? null,
      })
      .execute();
  } catch (error) {
    logger.error("AUDIT WRITE FAILED", {
      error,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      actor: actor.email,
    });
  }
}

/** Most recent first. Admin only — see the route. */
export function list(options: {
  limit: number;
  before?: number | null;
  entity?: string | null;
  actorId?: string | null;
}) {
  let q = db
    .selectFrom("audit_log")
    .select([
      "id",
      "at",
      "actor_email",
      "actor_role",
      "action",
      "entity",
      "entity_id",
      "summary",
    ])
    .orderBy("id", "desc")
    .limit(options.limit);

  if (options.before) q = q.where("id", "<", options.before);
  if (options.entity) q = q.where("entity", "=", options.entity);
  if (options.actorId) q = q.where("actor_id", "=", options.actorId);

  return q.execute();
}

export type AuditRow = Awaited<ReturnType<typeof list>>[number];
