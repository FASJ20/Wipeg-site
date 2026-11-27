import { db, sql } from "../lib/db.js";

/**
 * Everything a student can see about themselves.
 *
 * Every function here takes a `studentId` and filters on it. There is no
 * function in this file that can return another student's data, which is
 * what keeps the portal safe even if a controller forgets a check.
 */

/** Which class, level, campus; on campus or online. */
export function enrolment(studentId: string) {
  return db
    .selectFrom("enrolments as e")
    .innerJoin("classes as cl", "cl.id", "e.class_id")
    .innerJoin("departments as d", "d.id", "cl.department_id")
    .innerJoin("campuses as cmp", "cmp.id", "cl.campus_id")
    .innerJoin("academic_years as ay", "ay.id", "cl.academic_year_id")
    .innerJoin("levels as l", "l.level", "cl.level")
    .innerJoin("awards as aw", "aw.id", "l.award_id")
    .leftJoin("specialisations as sp", "sp.id", "cl.specialisation_id")
    .select([
      "e.id as enrolment_id",
      "e.status",
      "e.delivery_mode",
      "e.started_on",
      "cl.level",
      "d.name as department",
      "cmp.name as campus",
      "ay.label as academic_year",
      "aw.name as award",
      // Level 1 has no specialisation, by the department-wide rule. Saying
      // so plainly beats showing an empty field the student cannot explain.
      sql<string>`coalesce(sp.name, 'Level 1 (shared)')`.as("specialisation"),
    ])
    .where("e.student_id", "=", studentId)
    .where("e.status", "=", "active")
    .executeTakeFirst();
}

/** The subjects they are taking this year, and who teaches each. */
export function subjects(studentId: string) {
  return db
    .selectFrom("enrolments as e")
    .innerJoin("course_offerings as co", "co.class_id", "e.class_id")
    .innerJoin("courses as c", "c.id", "co.course_id")
    .innerJoin("terms as t", "t.id", "co.term_id")
    .innerJoin("academic_years as ay", "ay.id", "co.academic_year_id")
    .select((eb) => [
      "co.id as offering_id",
      "c.code as course_code",
      "c.title as course_title",
      "c.credit_hours",
      "t.name as term",
      "t.term_no",
      "ay.label as academic_year",
      // Lecturers as one line rather than a row each, so the portal does not
      // have to stitch them back together.
      sql<string | null>`(
        SELECT string_agg(p.given_names || ' ' || p.surname, ', ' ORDER BY ta.role)
          FROM teaching_assignments ta
          JOIN persons p ON p.id = ta.staff_id
         WHERE ta.course_offering_id = co.id
      )`.as("lecturers"),
    ])
    .where("e.student_id", "=", studentId)
    .where("e.status", "=", "active")
    .where("co.is_active", "=", true)
    .orderBy("t.term_no")
    .orderBy("c.code")
    .execute();
}

/**
 * Published results only.
 *
 * The view already filters to published, so a draft or a submitted-but-not-
 * released mark cannot reach a student even by accident.
 */
export function results(studentId: string) {
  return db
    .selectFrom("student_results")
    .selectAll()
    .where("student_id", "=", studentId)
    .orderBy("academic_year", "desc")
    .orderBy("term")
    .orderBy("course_code")
    .execute();
}

/**
 * The weighted average of published results, by credit hours.
 *
 * Calculated on read like everything else. A subject with no credit hours
 * recorded counts as one, so a missing value does not silently drop a
 * subject out of the average.
 */
export async function gradePointAverage(studentId: string) {
  const row = await db
    .selectFrom("student_results")
    .select([
      sql<number>`round(
        sum(grade_point * coalesce(credit_hours, 1))::numeric
        / nullif(sum(coalesce(credit_hours, 1)), 0)
      , 2)`.as("gpa"),
      sql<number>`count(*)::int`.as("subjects"),
      sql<number>`count(*) FILTER (WHERE is_pass)::int`.as("passed"),
    ])
    .where("student_id", "=", studentId)
    .executeTakeFirst();

  return {
    gpa: row?.gpa ?? null,
    subjects: row?.subjects ?? 0,
    passed: row?.passed ?? 0,
  };
}

/** How often they turned up, per subject. */
export function attendance(studentId: string) {
  return db
    .selectFrom("attendance_summary")
    .selectAll()
    .where("student_id", "=", studentId)
    .orderBy("course_code")
    .execute();
}

/** What is owed, what has been paid, and what falls due next. */
export async function fees(studentId: string) {
  const summary = await db
    .selectFrom("fee_status")
    .select([
      "enrolment_id",
      "total_charged",
      "total_paid",
      "balance",
      "next_due_on",
      "status",
    ])
    .where("student_id", "=", studentId)
    .executeTakeFirst();

  if (!summary) {
    return { summary: null, instalments: [], receipts: [] };
  }

  const [instalments, receipts] = await Promise.all([
    db
      .selectFrom("student_charges")
      .select(["sequence", "label", "amount_due", "due_on", "waived", "waiver_reason"])
      .where("enrolment_id", "=", summary.enrolment_id)
      .orderBy("sequence")
      .execute(),

    // The student's own receipts, so they can check a payment arrived.
    // Reversals carry a negative amount and are shown, not hidden — a
    // correction the student cannot see is a correction they will dispute.
    db
      .selectFrom("fee_receipts")
      .select([
        "receipt_no",
        "amount",
        "method",
        "received_on",
        "reversal_reason",
      ])
      .where("enrolment_id", "=", summary.enrolment_id)
      .orderBy("received_on", "desc")
      .execute(),
  ]);

  return { summary, instalments, receipts };
}

/** What is on file for them, and so by omission what is still missing. */
export function documents(personId: string) {
  return db
    .selectFrom("documents")
    .select([
      "id",
      "kind",
      "original_name",
      "content_type",
      "byte_size",
      "uploaded_at",
      // Shown so a student knows whether the registry has actually accepted
      // the document, not merely received it.
      "verified_at",
    ])
    .where("person_id", "=", personId)
    .orderBy("kind")
    .execute();
}
