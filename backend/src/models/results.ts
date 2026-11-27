import { db, sql } from "../lib/db.js";

/**
 * The registry's side of results: what is waiting, and releasing it.
 *
 * The lecturer's side is models/teaching.ts. Split because they are two
 * different jobs with two different permissions — entering a mark and
 * deciding the whole school may see it.
 */

/** Subjects with marks submitted and not yet published. */
export function awaitingPublication() {
  return db
    .selectFrom("results as r")
    .innerJoin("course_offerings as co", "co.id", "r.course_offering_id")
    .innerJoin("courses as c", "c.id", "co.course_id")
    .innerJoin("classes as cl", "cl.id", "co.class_id")
    .innerJoin("departments as d", "d.id", "cl.department_id")
    .innerJoin("campuses as cmp", "cmp.id", "cl.campus_id")
    .innerJoin("terms as t", "t.id", "co.term_id")
    .leftJoin("specialisations as sp", "sp.id", "cl.specialisation_id")
    .select([
      "co.id as offering_id",
      "c.code as course_code",
      "c.title as course_title",
      "cl.level",
      "d.name as department",
      "cmp.name as campus",
      "t.name as term",
      sql<string>`coalesce(sp.name, 'Level 1 (shared)')`.as("specialisation"),
      sql<number>`count(*)::int`.as("submitted"),
      sql<string | null>`(
        SELECT string_agg(DISTINCT p.given_names || ' ' || p.surname, ', ')
          FROM teaching_assignments ta
          JOIN persons p ON p.id = ta.staff_id
         WHERE ta.course_offering_id = co.id
      )`.as("lecturers"),
    ])
    .where("r.status", "=", "submitted")
    .groupBy([
      "co.id",
      "c.code",
      "c.title",
      "cl.level",
      "d.name",
      "cmp.name",
      "t.name",
      "sp.name",
    ])
    .orderBy("cmp.name")
    .orderBy("c.code")
    .execute();
}

/** Every submitted mark for one subject, so the registry can read it first. */
export function submittedFor(offeringId: string) {
  return db
    .selectFrom("results as r")
    .innerJoin("enrolments as e", "e.id", "r.enrolment_id")
    .innerJoin("students as s", "s.person_id", "e.student_id")
    .innerJoin("persons as p", "p.id", "s.person_id")
    .leftJoin("persons as ent", "ent.id", "r.entered_by")
    .select([
      "r.id as result_id",
      "s.matricule",
      "p.surname",
      "p.given_names",
      "r.ca_mark",
      "r.exam_mark",
      "r.attempt",
      "r.remark",
      "r.status",
      "r.entered_at",
      sql<number>`round(coalesce(r.ca_mark,0) * 0.30 + coalesce(r.exam_mark,0) * 0.70, 2)`.as(
        "total_mark",
      ),
      sql<string | null>`ent.given_names || ' ' || ent.surname`.as("entered_by"),
    ])
    .where("r.course_offering_id", "=", offeringId)
    .where("r.status", "in", ["submitted", "published"])
    .orderBy("p.surname")
    .execute();
}

/**
 * Release a subject's marks to its students.
 *
 * Only `submitted` rows move. Publishing is the irreversible-feeling step —
 * a student who has seen a mark cannot unsee it — so it is deliberate,
 * explicit, and stamped with who did it and when.
 */
export async function publish(
  offeringId: string,
  publishedBy: string,
): Promise<number> {
  const result = await db
    .updateTable("results")
    .set({
      status: "published",
      published_by: publishedBy,
      published_at: new Date(),
    })
    .where("course_offering_id", "=", offeringId)
    .where("status", "=", "submitted")
    .executeTakeFirst();

  return Number(result.numUpdatedRows ?? 0);
}

/**
 * Send a subject's marks back to the lecturer.
 *
 * `submitted` returns to `draft`. Published marks are deliberately NOT
 * pulled back: students have seen them, and quietly withdrawing a result
 * they have already read is worse than correcting it in the open. A
 * published mark is changed by entering a correction, not by hiding it.
 */
export async function returnToLecturer(offeringId: string): Promise<number> {
  const result = await db
    .updateTable("results")
    .set({ status: "draft" })
    .where("course_offering_id", "=", offeringId)
    .where("status", "=", "submitted")
    .executeTakeFirst();

  return Number(result.numUpdatedRows ?? 0);
}

/** One offering's headline, for the audit entry and the response. */
export function offeringLabel(offeringId: string) {
  return db
    .selectFrom("course_offerings as co")
    .innerJoin("courses as c", "c.id", "co.course_id")
    .innerJoin("classes as cl", "cl.id", "co.class_id")
    .innerJoin("campuses as cmp", "cmp.id", "cl.campus_id")
    .innerJoin("terms as t", "t.id", "co.term_id")
    .select([
      "co.id",
      "c.code as course_code",
      "c.title as course_title",
      "cl.level",
      "cmp.name as campus",
      "t.name as term",
    ])
    .where("co.id", "=", offeringId)
    .executeTakeFirst();
}
