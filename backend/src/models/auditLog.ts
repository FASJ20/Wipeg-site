import { query } from "../lib/db.js";
import { logger } from "../lib/logger.js";

/**
 * The audit log. Append-only: there is no update and no delete in this file,
 * and there should never be one.
 *
 * WIPEG runs a single Admin role, so whoever can record a receipt can also
 * change a matricule. This table is what replaces separation of duties. It is
 * only worth anything if writing to it is not optional, so every controller
 * that changes something calls `record` in the same breath.
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
 * A failure here is logged and swallowed. That is a deliberate and arguable
 * choice: the alternative is that a broken audit table stops the registry
 * enrolling students. Losing the trail is bad; being unable to run the
 * institute is worse. The error is logged at error level so it surfaces.
 */
export async function record(
  actor: AuditActor,
  entry: AuditEntry,
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log
         (actor_id, actor_email, actor_role, action, entity, entity_id,
          summary, before, after, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        actor.personId,
        actor.email,
        actor.role,
        entry.action,
        entry.entity,
        entry.entityId ?? null,
        entry.summary,
        entry.before === undefined ? null : JSON.stringify(entry.before),
        entry.after === undefined ? null : JSON.stringify(entry.after),
        actor.ip,
        actor.userAgent?.slice(0, 500) ?? null,
      ],
    );
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

export type AuditRow = {
  id: number;
  at: Date;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string;
};

/** Most recent first. Admin only — see the route. */
export async function list(options: {
  limit: number;
  before?: number | null;
  entity?: string | null;
  actorId?: string | null;
}): Promise<AuditRow[]> {
  return query<AuditRow>(
    `SELECT id, at, actor_email, actor_role, action, entity, entity_id, summary
       FROM audit_log
      WHERE ($2::bigint IS NULL OR id < $2)
        AND ($3::text   IS NULL OR entity = $3)
        AND ($4::uuid   IS NULL OR actor_id = $4)
      ORDER BY id DESC
      LIMIT $1`,
    [options.limit, options.before ?? null, options.entity ?? null, options.actorId ?? null],
  );
}
