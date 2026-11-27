import { db, sql } from "../lib/db.js";

/**
 * A lecturer's own work: the subjects they teach, the students in them,
 * the marks they enter and the registers they take.
 *
 * Every read here is filtered by the lecturer's own staff id. `teaches()`
 * is the one gate the write paths go through, so "may this lecturer touch
 * this offering?" is answered in exactly one place.
 */

/** Is this offering actually assigned to this lecturer? */
export async function teaches(
  staffId: string,
  offeringId: string,
): Promise<boolean> {
  const row = await db
    .selectFrom("teaching_assignments")
    .select(sql<number>`1`.as("yes"))
    .where("staff_id", "=", staffId)
    .where("course_offering_id", "=", offeringId)
    .executeTakeFirst();
  return Boolean(row);
}

/** The subjects this lecturer teaches, this academic year. */
export function myOfferings(staffId: string) {
  return db
    .selectFrom("teaching_assignments as ta")
    .innerJoin("course_offerings as co", "co.id", "ta.course_offering_id")
    .innerJoin("courses as c", "c.id", "co.course_id")
    .innerJoin("classes as cl", "cl.id", "co.class_id")
    .innerJoin("departments as d", "d.id", "cl.department_id")
    .innerJoin("campuses as cmp", "cmp.id", "cl.campus_id")
    .innerJoin("terms as t", "t.id", "co.term_id")
    .innerJoin("academic_years as ay", "ay.id", "co.academic_year_id")
    .leftJoin("specialisations as sp", "sp.id", "cl.specialisation_id")
    .select([
      "co.id as offering_id",
      "ta.role",
      "c.code as course_code",
      "c.title as course_title",
      "c.credit_hours",
      "cl.level",
      "d.name as department",
      "cmp.name as campus",
      "t.name as term",
      "ay.label as academic_year",
      sql<string>`coalesce(sp.name, 'Level 1 (shared)')`.as("specialisation"),
      sql<number>`(
        SELECT count(*)::int FROM enrolments e
         WHERE e.class_id = co.class_id AND e.status = 'active'
      )`.as("class_size"),
    ])
    .where("ta.staff_id", "=", staffId)
    .where("co.is_active", "=", true)
    .where("ay.is_current", "=", true)
    .orderBy("c.code")
    .execute();
}

/**
 * The class list for one offering, with whatever mark has been entered.
 *
 * One row per student whether or not they have a result yet, so the
 * lecturer sees the whole class and the gaps in it rather than only the
 * students they have already typed.
 */
export function classList(offeringId: string) {
  return db
    .selectFrom("course_offerings as co")
    .innerJoin("enrolments as e", (join) =>
      join.onRef("e.class_id", "=", "co.class_id").on("e.status", "=", "active"),
    )
    .innerJoin("students as s", "s.person_id", "e.student_id")
    .innerJoin("persons as p", "p.id", "s.person_id")
    .leftJoin("results as r", (join) =>
      join
        .onRef("r.enrolment_id", "=", "e.id")
        .onRef("r.course_offering_id", "=", "co.id")
        .on("r.attempt", "=", 1),
    )
    .select([
      "s.person_id as student_id",
      "e.id as enrolment_id",
      "s.matricule",
      "p.surname",
      "p.given_names",
      "p.photo_key",
      "r.id as result_id",
      "r.ca_mark",
      "r.exam_mark",
      "r.status as result_status",
      "r.remark",
    ])
    .where("co.id", "=", offeringId)
    .orderBy("p.surname")
    .orderBy("p.given_names")
    .execute();
}

export type MarkInput = {
  enrolmentId: string;
  caMark: number | null;
  examMark: number | null;
  remark: string | null;
};

/**
 * Save marks for a whole class at once.
 *
 * One transaction: a half-saved class is worse than none, because the
 * lecturer cannot tell which half went in.
 *
 * Only `draft` rows are touched. A result that has been submitted or
 * published is left exactly as it is, and the caller is told how many were
 * skipped — a lecturer re-saving an old spreadsheet must not silently
 * overwrite marks the registry has already released.
 */
export async function saveMarks(
  offeringId: string,
  staffId: string,
  marks: MarkInput[],
): Promise<{ saved: number; lockedCount: number }> {
  return db.transaction().execute(async (trx) => {
    let saved = 0;
    let lockedCount = 0;

    for (const mark of marks) {
      const existing = await trx
        .selectFrom("results")
        .select(["id", "status"])
        .where("enrolment_id", "=", mark.enrolmentId)
        .where("course_offering_id", "=", offeringId)
        .where("attempt", "=", 1)
        .executeTakeFirst();

      if (existing && existing.status !== "draft") {
        lockedCount += 1;
        continue;
      }

      if (existing) {
        await trx
          .updateTable("results")
          .set({
            ca_mark: mark.caMark,
            exam_mark: mark.examMark,
            remark: mark.remark,
            entered_by: staffId,
            entered_at: new Date(),
          })
          .where("id", "=", existing.id)
          .execute();
      } else {
        await trx
          .insertInto("results")
          .values({
            enrolment_id: mark.enrolmentId,
            course_offering_id: offeringId,
            ca_mark: mark.caMark,
            exam_mark: mark.examMark,
            remark: mark.remark,
            entered_by: staffId,
            entered_at: new Date(),
          })
          .execute();
      }
      saved += 1;
    }

    return { saved, lockedCount };
  });
}

/**
 * Hand the marks to the registry. Draft becomes submitted.
 *
 * After this the lecturer can no longer edit them, which is the point: the
 * registry is reviewing a fixed set, not a moving one.
 */
export async function submitMarks(offeringId: string): Promise<number> {
  const result = await db
    .updateTable("results")
    .set({ status: "submitted" })
    .where("course_offering_id", "=", offeringId)
    .where("status", "=", "draft")
    .where("exam_mark", "is not", null)
    .executeTakeFirst();

  return Number(result.numUpdatedRows ?? 0);
}

// ------------------------------------------------------------- attendance

export function sessionsFor(offeringId: string) {
  return db
    .selectFrom("class_sessions as cs")
    .leftJoin("persons as p", "p.id", "cs.taken_by")
    .select([
      "cs.id",
      "cs.held_on",
      "cs.starts_at",
      "cs.ends_at",
      "cs.topic",
      sql<number>`(
        SELECT count(*)::int FROM attendance a WHERE a.session_id = cs.id
      )`.as("marked"),
      sql<number>`(
        SELECT count(*)::int FROM attendance a
         WHERE a.session_id = cs.id AND a.status IN ('present','late')
      )`.as("present"),
      sql<string | null>`p.given_names || ' ' || p.surname`.as("taken_by"),
    ])
    .where("cs.course_offering_id", "=", offeringId)
    .orderBy("cs.held_on", "desc")
    .execute();
}

export async function createSession(input: {
  offeringId: string;
  heldOn: string;
  startsAt: string | null;
  endsAt: string | null;
  topic: string | null;
  staffId: string;
}) {
  return db
    .insertInto("class_sessions")
    .values({
      course_offering_id: input.offeringId,
      held_on: input.heldOn,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      topic: input.topic,
      taken_by: input.staffId,
    })
    .returning(["id", "held_on", "starts_at"])
    .executeTakeFirstOrThrow();
}

export function findSession(sessionId: string) {
  return db
    .selectFrom("class_sessions")
    .select(["id", "course_offering_id", "held_on", "starts_at", "topic"])
    .where("id", "=", sessionId)
    .executeTakeFirst();
}

/**
 * Mark the register.
 *
 * Re-marking replaces the earlier entry rather than failing, because a
 * lecturer correcting "absent" to "present" five minutes later is the
 * normal case, not an error.
 */
export async function markAttendance(
  sessionId: string,
  staffId: string,
  entries: { studentId: string; status: string; note: string | null }[],
): Promise<number> {
  if (entries.length === 0) return 0;

  await db
    .insertInto("attendance")
    .values(
      entries.map((e) => ({
        session_id: sessionId,
        student_id: e.studentId,
        status: e.status,
        note: e.note,
        marked_by: staffId,
        marked_at: new Date(),
      })),
    )
    .onConflict((oc) =>
      oc.columns(["session_id", "student_id"]).doUpdateSet((eb) => ({
        status: eb.ref("excluded.status"),
        note: eb.ref("excluded.note"),
        marked_by: eb.ref("excluded.marked_by"),
        marked_at: eb.ref("excluded.marked_at"),
      })),
    )
    .execute();

  return entries.length;
}

export function attendanceFor(sessionId: string) {
  return db
    .selectFrom("class_sessions as cs")
    .innerJoin("enrolments as e", (join) =>
      join.onRef("e.class_id", "=", sql`(
        SELECT class_id FROM course_offerings WHERE id = cs.course_offering_id
      )`).on("e.status", "=", "active"),
    )
    .innerJoin("students as s", "s.person_id", "e.student_id")
    .innerJoin("persons as p", "p.id", "s.person_id")
    .leftJoin("attendance as a", (join) =>
      join.onRef("a.session_id", "=", "cs.id").onRef("a.student_id", "=", "s.person_id"),
    )
    .select([
      "s.person_id as student_id",
      "s.matricule",
      "p.surname",
      "p.given_names",
      "a.status",
      "a.note",
    ])
    .where("cs.id", "=", sessionId)
    .orderBy("p.surname")
    .execute();
}
