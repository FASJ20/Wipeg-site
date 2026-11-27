import { query } from "../lib/db.js";

/**
 * What the Classroom sync reads and writes.
 *
 * All the SQL for Classroom lives here. The service in
 * services/google/classroom.ts talks to Google and knows nothing about
 * tables; this file knows about tables and nothing about Google.
 */

export type OfferingToSync = {
  offering_id: string;
  course_code: string;
  course_title: string;
  section: string;
  room: string;
  google_course_id: string | null;
};

/**
 * Active offerings in the current academic year.
 *
 * `section` and `room` are built here rather than in the service because
 * they are made of WIPEG's own vocabulary — Level, specialisation, campus,
 * term — and that belongs with the query that knows those joins.
 *
 * Level 1 has no specialisation by design (the department-wide rule), so the
 * label falls back to the department name, which is exactly what a Level 1
 * student would expect to see at the top of their Classroom.
 */
export function offeringsToSync(limit = 200): Promise<OfferingToSync[]> {
  return query<OfferingToSync>(
    `SELECT
       co.id                AS offering_id,
       c.code               AS course_code,
       c.title              AS course_title,
       concat_ws(' — ',
         'Level ' || cl.level,
         COALESCE(sp.name, d.name),
         cmp.name
       )                    AS section,
       concat_ws(' ', t.name, ay.label) AS room,
       co.google_course_id
     FROM course_offerings co
     JOIN courses          c   ON c.id  = co.course_id
     JOIN classes          cl  ON cl.id = co.class_id
     JOIN departments      d   ON d.id  = cl.department_id
     JOIN campuses         cmp ON cmp.id = cl.campus_id
     JOIN terms            t   ON t.id  = co.term_id
     JOIN academic_years   ay  ON ay.id = co.academic_year_id
     LEFT JOIN specialisations sp ON sp.id = cl.specialisation_id
     WHERE co.is_active
       AND cl.is_active
       AND ay.is_current
     ORDER BY cmp.name, cl.level, c.code
     LIMIT $1`,
    [limit],
  );
}

/**
 * The people who belong in one offering's Classroom.
 *
 * Only those with a school email: a Classroom roster is keyed on a Google
 * account, so somebody whose Workspace account has not been created yet
 * simply is not ready to be added. They are counted as skipped rather than
 * failed, and the next run picks them up once provisioning has happened.
 */
export async function rosterFor(offeringId: string): Promise<{
  students: string[];
  teachers: string[];
  studentsWithoutEmail: number;
}> {
  const [students, teachers, missing] = await Promise.all([
    query<{ school_email: string }>(
      `SELECT p.school_email
         FROM course_offerings co
         JOIN enrolments e ON e.class_id = co.class_id AND e.status = 'active'
         JOIN students   s ON s.person_id = e.student_id AND s.status = 'active'
         JOIN persons    p ON p.id = s.person_id
        WHERE co.id = $1
          AND p.school_email IS NOT NULL
        ORDER BY p.school_email`,
      [offeringId],
    ),
    query<{ school_email: string }>(
      `SELECT p.school_email
         FROM teaching_assignments ta
         JOIN staff   sf ON sf.person_id = ta.staff_id AND sf.status <> 'former'
         JOIN persons p  ON p.id = sf.person_id
        WHERE ta.course_offering_id = $1
          AND p.school_email IS NOT NULL
        ORDER BY ta.role, p.school_email`,
      [offeringId],
    ),
    query<{ count: number }>(
      `SELECT count(*)::int AS count
         FROM course_offerings co
         JOIN enrolments e ON e.class_id = co.class_id AND e.status = 'active'
         JOIN students   s ON s.person_id = e.student_id AND s.status = 'active'
         JOIN persons    p ON p.id = s.person_id
        WHERE co.id = $1
          AND p.school_email IS NULL`,
      [offeringId],
    ),
  ]);

  return {
    students: students.map((r) => r.school_email),
    teachers: teachers.map((r) => r.school_email),
    studentsWithoutEmail: missing[0]?.count ?? 0,
  };
}

/**
 * Remember the Classroom id against the offering.
 *
 * `google_course_id` is UNIQUE in the schema, so two offerings can never
 * claim the same Classroom even if a sync is somehow run twice at once.
 */
export async function recordCourseId(
  offeringId: string,
  googleCourseId: string,
): Promise<void> {
  await query(
    `UPDATE course_offerings
        SET google_course_id = $2
      WHERE id = $1
        AND (google_course_id IS DISTINCT FROM $2)`,
    [offeringId, googleCourseId],
  );
}
