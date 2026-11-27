import { db, sql } from "../lib/db.js";

/**
 * People asking to join, before anybody has said yes.
 *
 * A row here grants nothing. It is a request in a queue, and an admin
 * turning it into a real `persons` row is the moment access begins.
 */

export type RequestKind = "student" | "lecturer" | "admin";

export type NewRequest = {
  kind: RequestKind;
  surname: string;
  givenNames: string;
  email: string;
  phone: string;
  passwordHash: string;
  campusId?: string | null;
  departmentId?: string | null;
  levelApplied?: number | null;
  message?: string | null;
};

export async function create(input: NewRequest) {
  return db
    .insertInto("account_requests")
    .values({
      kind: input.kind,
      surname: input.surname,
      given_names: input.givenNames,
      email: input.email.toLowerCase(),
      phone: input.phone,
      password_hash: input.passwordHash,
      campus_id: input.campusId ?? null,
      department_id: input.departmentId ?? null,
      level_applied: input.levelApplied ?? null,
      message: input.message ?? null,
    })
    .returning(["id", "kind", "created_at"])
    .executeTakeFirstOrThrow();
}

/** Is there already an open request on this address? */
export async function pendingForEmail(email: string) {
  return db
    .selectFrom("account_requests")
    .select(["id", "kind", "created_at"])
    .where(sql`lower(email)`, "=", email.toLowerCase())
    .where("status", "=", "pending")
    .executeTakeFirst();
}

/** The queue an admin works through. Oldest first — nobody should be left. */
export function listPending(kind?: RequestKind | null, limit = 100) {
  let q = db
    .selectFrom("account_requests as r")
    .leftJoin("campuses as c", "c.id", "r.campus_id")
    .leftJoin("departments as d", "d.id", "r.department_id")
    .select([
      "r.id",
      "r.kind",
      "r.surname",
      "r.given_names",
      "r.email",
      "r.phone",
      "r.level_applied",
      "r.message",
      "r.created_at",
      "c.name as campus",
      "d.name as department",
    ])
    .where("r.status", "=", "pending")
    .orderBy("r.created_at")
    .limit(limit);

  if (kind) q = q.where("r.kind", "=", kind);
  return q.execute();
}

export function findById(id: string) {
  return db
    .selectFrom("account_requests")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function reject(
  id: string,
  reviewerId: string,
  reason: string,
): Promise<void> {
  await db
    .updateTable("account_requests")
    .set({
      status: "rejected",
      reject_reason: reason,
      reviewed_by: reviewerId,
      reviewed_at: new Date(),
    })
    .where("id", "=", id)
    .where("status", "=", "pending")
    .execute();
}

/**
 * Turn an approved request into a real person.
 *
 * One transaction: the person, the student or staff row, the admin grant if
 * one was asked for, and the request being marked approved. A half-finished
 * approval would leave somebody able to sign in with no role, or a role with
 * nobody attached, so it is all or nothing.
 *
 * The password the person chose at registration moves across with them. They
 * are never emailed a password, and nobody ever needs to read theirs.
 */
export async function approve(
  requestId: string,
  reviewerId: string,
  options: { grantAdmin: boolean },
): Promise<{ personId: string }> {
  return db.transaction().execute(async (trx) => {
    const request = await trx
      .selectFrom("account_requests")
      .selectAll()
      .where("id", "=", requestId)
      .where("status", "=", "pending")
      .forUpdate()
      .executeTakeFirstOrThrow();

    const person = await trx
      .insertInto("persons")
      .values({
        surname: request.surname,
        given_names: request.given_names,
        // The registry corrects this against the birth certificate later;
        // it cannot be null, and the person's own spelling is the best
        // starting point available at registration.
        name_on_id: `${request.given_names} ${request.surname}`,
        phone: request.phone,
        personal_email: request.email,
        password_hash: request.password_hash,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    if (request.kind === "student") {
      await trx
        .insertInto("students")
        .values({
          person_id: person.id,
          // Both are NOT NULL and unknown at self-registration. The registry
          // fills them in when the student brings their papers.
          guardian_name: "To be confirmed",
          guardian_phone: request.phone,
        })
        .execute();
    } else {
      await trx
        .insertInto("staff")
        .values({
          person_id: person.id,
          job_title: request.kind === "admin" ? "Administrator" : "Lecturer",
        })
        .execute();

      if (request.kind === "admin" && options.grantAdmin) {
        await trx
          .insertInto("staff_roles")
          .values({
            staff_id: person.id,
            role: "admin",
            granted_by: reviewerId,
          })
          .execute();
      }
    }

    await trx
      .updateTable("account_requests")
      .set({
        status: "approved",
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
        person_id: person.id,
      })
      .where("id", "=", requestId)
      .execute();

    return { personId: person.id };
  });
}

/**
 * Find somebody by the address they signed in with.
 *
 * Checks the school address first and the personal one second, because a
 * student who registered with a Gmail keeps using it until the registry
 * issues their @wipeg.online address — and should not be locked out on the
 * day that happens.
 */
export function findPersonForPasswordLogin(email: string) {
  return db
    .selectFrom("persons")
    .select(["id", "password_hash"])
    .where((eb) =>
      eb.or([
        eb(sql`lower(school_email)`, "=", email.toLowerCase()),
        eb(sql`lower(personal_email)`, "=", email.toLowerCase()),
      ]),
    )
    .executeTakeFirst();
}
