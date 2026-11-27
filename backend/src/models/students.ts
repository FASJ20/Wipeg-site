import { db, sql } from "../lib/db.js";

/**
 * Student records, as the registry sees them.
 *
 * Distinct from models/student.ts, which is a student's view of themselves
 * and can only ever return one row. Everything here takes an id or a filter
 * and can return anybody, so every caller must be behind an admin guard.
 */

export type StudentFilters = {
  search?: string | null;
  campusId?: string | null;
  departmentId?: string | null;
  level?: number | null;
  status?: string | null;
  limit: number;
  /** The `created_at` of the last row on the previous page. */
  cursor?: string | null;
};

/**
 * Search and list.
 *
 * Cursor paging on `created_at`, not OFFSET: a clerk paging through students
 * while somebody else enrols one would otherwise see a row twice or skip
 * one, because OFFSET counts into a set that is shifting underneath it.
 */
export async function list(filters: StudentFilters) {
  let q = db
    .selectFrom("students as s")
    .innerJoin("persons as p", "p.id", "s.person_id")
    .leftJoin("enrolments as e", (join) =>
      join.onRef("e.student_id", "=", "s.person_id").on("e.status", "=", "active"),
    )
    .leftJoin("classes as cl", "cl.id", "e.class_id")
    .leftJoin("departments as d", "d.id", "cl.department_id")
    .leftJoin("campuses as cmp", "cmp.id", "cl.campus_id")
    .select([
      "s.person_id",
      "s.matricule",
      "s.status",
      "p.surname",
      "p.given_names",
      "p.phone",
      "p.school_email",
      "p.photo_key",
      "p.created_at",
      "cl.level",
      "d.name as department",
      "cmp.name as campus",
    ])
    .orderBy("p.created_at", "desc")
    .limit(filters.limit + 1);

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    q = q.where((eb) =>
      eb.or([
        eb(sql`p.surname`, "ilike", term),
        eb(sql`p.given_names`, "ilike", term),
        eb(sql`s.matricule`, "ilike", term),
        eb(sql`p.phone`, "ilike", term),
      ]),
    );
  }
  if (filters.campusId) q = q.where("cl.campus_id", "=", filters.campusId);
  if (filters.departmentId) q = q.where("cl.department_id", "=", filters.departmentId);
  if (filters.level) q = q.where("cl.level", "=", filters.level);
  if (filters.status) q = q.where("s.status", "=", filters.status);
  if (filters.cursor) q = q.where("p.created_at", "<", new Date(filters.cursor));

  const rows = await q.execute();

  // One extra was fetched to find out whether another page exists, without a
  // second COUNT query over the whole table.
  const hasMore = rows.length > filters.limit;
  const page = hasMore ? rows.slice(0, filters.limit) : rows;
  const last = page[page.length - 1];

  return {
    rows: page,
    nextCursor: hasMore && last ? new Date(last.created_at).toISOString() : null,
  };
}

/** One student, in full. */
export function findById(personId: string) {
  return db
    .selectFrom("students as s")
    .innerJoin("persons as p", "p.id", "s.person_id")
    .select([
      "s.person_id",
      "s.matricule",
      "s.status",
      "s.guardian_name",
      "s.guardian_phone",
      "s.guardian_relation",
      "p.surname",
      "p.given_names",
      "p.name_on_id",
      "p.sex",
      "p.date_of_birth",
      "p.place_of_birth",
      "p.nationality",
      "p.phone",
      "p.phone_alt",
      "p.personal_email",
      "p.school_email",
      "p.preferred_language",
      "p.address_town",
      "p.address_detail",
      "p.photo_key",
      "p.created_at",
    ])
    .where("s.person_id", "=", personId)
    .executeTakeFirst();
}

/**
 * The reduced view a lecturer gets: enough to mark a register and know they
 * have the right person. No fees, no documents, no address, no guardian.
 */
export function findBasics(personId: string) {
  return db
    .selectFrom("students as s")
    .innerJoin("persons as p", "p.id", "s.person_id")
    .select([
      "s.person_id",
      "s.matricule",
      "s.status",
      "p.surname",
      "p.given_names",
      "p.photo_key",
    ])
    .where("s.person_id", "=", personId)
    .executeTakeFirst();
}

/**
 * Does this lecturer actually teach this student?
 *
 * True when the student has an active enrolment in a class that has an
 * offering the lecturer is assigned to. Anything else is a no, including
 * "teaches in the same department".
 */
export async function lecturerTeaches(
  staffId: string,
  studentId: string,
): Promise<boolean> {
  const row = await db
    .selectFrom("teaching_assignments as ta")
    .innerJoin("course_offerings as co", "co.id", "ta.course_offering_id")
    .innerJoin("enrolments as e", (join) =>
      join.onRef("e.class_id", "=", "co.class_id").on("e.status", "=", "active"),
    )
    .select(sql<number>`1`.as("yes"))
    .where("ta.staff_id", "=", staffId)
    .where("e.student_id", "=", studentId)
    .limit(1)
    .executeTakeFirst();

  return Boolean(row);
}

export type PersonPatch = Partial<{
  surname: string;
  given_names: string;
  name_on_id: string;
  sex: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  nationality: string;
  phone: string;
  phone_alt: string | null;
  personal_email: string | null;
  preferred_language: string;
  address_town: string | null;
  address_detail: string | null;
}>;

export type StudentPatch = Partial<{
  matricule: string | null;
  guardian_name: string;
  guardian_phone: string;
  guardian_relation: string | null;
  status: string;
}>;

/**
 * Update a student. One transaction across both tables, because a name
 * change that half-applied is worse than one that failed.
 */
export async function update(
  personId: string,
  person: PersonPatch,
  student: StudentPatch,
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    if (Object.keys(person).length > 0) {
      await trx
        .updateTable("persons")
        .set(person)
        .where("id", "=", personId)
        .execute();
    }
    if (Object.keys(student).length > 0) {
      await trx
        .updateTable("students")
        .set(student)
        .where("person_id", "=", personId)
        .execute();
    }
  });
}

/**
 * "Delete" a student: mark them withdrawn.
 *
 * Nothing is removed. A student who leaves in October may re-enrol in
 * February, and a deleted record takes their transcript and the history of
 * every franc they paid with it. The database would refuse a real delete
 * anyway — every link to a student is ON DELETE RESTRICT — and that
 * protection is deliberate rather than an obstacle to work around.
 *
 * Their active enrolment is closed in the same transaction, otherwise they
 * stay on class lists and keep being counted in a class they have left.
 */
export async function withdraw(
  personId: string,
  reason: string,
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("students")
      .set({ status: "withdrawn" })
      .where("person_id", "=", personId)
      .execute();

    await trx
      .updateTable("enrolments")
      .set({ status: "withdrawn", ended_on: new Date() })
      .where("student_id", "=", personId)
      .where("status", "=", "active")
      .execute();

    // The reason itself belongs in the audit log, which the controller
    // writes. It is a required argument here so the signature makes that
    // obligation visible rather than leaving it to be remembered.
    void reason;
  });
}

/** Bring a withdrawn student back. The counterpart of `withdraw`. */
export async function reinstate(personId: string): Promise<void> {
  await db
    .updateTable("students")
    .set({ status: "active" })
    .where("person_id", "=", personId)
    .execute();
}
