import { db, sql } from "../lib/db.js";

/**
 * What the Classroom sync reads and writes.
 *
 * All the Classroom SQL lives here. The service in
 * services/google/classroom.ts talks to Google and knows nothing about
 * tables; this file knows about tables and nothing about Google.
 */

/**
 * Active offerings in the current academic year.
 *
 * `section` and `room` are built here rather than in the service, because
 * they are made of WIPEG's own vocabulary — level, specialisation, campus,
 * term — and that belongs with the query that knows those joins.
 *
 * Level 1 has no specialisation, by the department-wide rule, so the label
 * falls back to the department name. That is exactly what a Level 1 student
 * expects to read at the top of their Classroom.
 */
export function offeringsToSync(limit = 200) {
  return db
    .selectFrom("course_offerings as co")
    .innerJoin("courses as c", "c.id", "co.course_id")
    .innerJoin("classes as cl", "cl.id", "co.class_id")
    .innerJoin("departments as d", "d.id", "cl.department_id")
    .innerJoin("campuses as cmp", "cmp.id", "cl.campus_id")
    .innerJoin("terms as t", "t.id", "co.term_id")
    .innerJoin("academic_years as ay", "ay.id", "co.academic_year_id")
    .leftJoin("specialisations as sp", "sp.id", "cl.specialisation_id")
    .select([
      "co.id as offering_id",
      "c.code as course_code",
      "c.title as course_title",
      "co.google_course_id",
      sql<string>`concat_ws(' — ', 'Level ' || cl.level, coalesce(sp.name, d.name), cmp.name)`.as(
        "section",
      ),
      sql<string>`concat_ws(' ', t.name, ay.label)`.as("room"),
    ])
    .where("co.is_active", "=", true)
    .where("cl.is_active", "=", true)
    .where("ay.is_current", "=", true)
    .orderBy("cmp.name")
    .orderBy("cl.level")
    .orderBy("c.code")
    .limit(limit)
    .execute();
}

export type OfferingToSync = Awaited<
  ReturnType<typeof offeringsToSync>
>[number];

/**
 * The people who belong in one offering's Classroom.
 *
 * Only those with a school email: a Classroom roster is keyed on a Google
 * account, so somebody whose Workspace account has not been created yet is
 * simply not ready to be added. They are counted as waiting rather than
 * failed, and the next run picks them up once provisioning has happened.
 */
export async function rosterFor(offeringId: string): Promise<{
  students: string[];
  teachers: string[];
  studentsWithoutEmail: number;
}> {
  const enrolledStudents = () =>
    db
      .selectFrom("course_offerings as co")
      .innerJoin("enrolments as e", (join) =>
        join.onRef("e.class_id", "=", "co.class_id").on("e.status", "=", "active"),
      )
      .innerJoin("students as s", (join) =>
        join.onRef("s.person_id", "=", "e.student_id").on("s.status", "=", "active"),
      )
      .innerJoin("persons as p", "p.id", "s.person_id")
      .where("co.id", "=", offeringId);

  const [students, teachers, missing] = await Promise.all([
    enrolledStudents()
      .select("p.school_email")
      .where("p.school_email", "is not", null)
      .orderBy("p.school_email")
      .execute(),

    db
      .selectFrom("teaching_assignments as ta")
      .innerJoin("staff as sf", (join) =>
        join.onRef("sf.person_id", "=", "ta.staff_id").on("sf.status", "!=", "former"),
      )
      .innerJoin("persons as p", "p.id", "sf.person_id")
      .select("p.school_email")
      .where("ta.course_offering_id", "=", offeringId)
      .where("p.school_email", "is not", null)
      .orderBy("ta.role")
      .orderBy("p.school_email")
      .execute(),

    enrolledStudents()
      .select(sql<number>`count(*)::int`.as("count"))
      .where("p.school_email", "is", null)
      .executeTakeFirst(),
  ]);

  return {
    students: students.map((r) => r.school_email).filter((e): e is string => !!e),
    teachers: teachers.map((r) => r.school_email).filter((e): e is string => !!e),
    studentsWithoutEmail: missing?.count ?? 0,
  };
}

/**
 * Remember the Classroom id against the offering.
 *
 * `google_course_id` is UNIQUE in the schema, so two offerings can never
 * claim the same Classroom even if a sync somehow runs twice at once.
 */
export async function recordCourseId(
  offeringId: string,
  googleCourseId: string,
): Promise<void> {
  await db
    .updateTable("course_offerings")
    .set({ google_course_id: googleCourseId })
    .where("id", "=", offeringId)
    .where((eb) =>
      eb.or([
        eb("google_course_id", "is", null),
        eb("google_course_id", "!=", googleCourseId),
      ]),
    )
    .execute();
}
