import { db, sql } from "../lib/db.js";

/**
 * Staff records, as the administration sees them.
 *
 * The same shape as models/students.ts on purpose: list, read, update, and
 * a `retire` that marks somebody former rather than deleting them. A
 * lecturer who taught a class three years ago is named on those results
 * forever, so their record cannot go.
 */

export type StaffFilters = {
  search?: string | null;
  departmentId?: string | null;
  status?: string | null;
  adminsOnly?: boolean;
  limit: number;
  cursor?: string | null;
};

export async function list(filters: StaffFilters) {
  let q = db
    .selectFrom("staff as sf")
    .innerJoin("persons as p", "p.id", "sf.person_id")
    .leftJoin("staff_roles as sr", (join) =>
      join
        .onRef("sr.staff_id", "=", "sf.person_id")
        .on("sr.role", "=", "admin")
        .on("sr.revoked_on", "is", null),
    )
    .select([
      "sf.person_id",
      "sf.staff_number",
      "sf.job_title",
      "sf.employment_type",
      "sf.status",
      "sf.hired_on",
      "p.surname",
      "p.given_names",
      "p.phone",
      "p.school_email",
      "p.created_at",
      sql<boolean>`sr.staff_id IS NOT NULL`.as("is_admin"),
      sql<number>`(
        SELECT count(*)::int FROM teaching_assignments ta
         WHERE ta.staff_id = sf.person_id
      )`.as("subjects_taught"),
      sql<string | null>`(
        SELECT string_agg(d.name, ', ' ORDER BY d.name)
          FROM staff_departments sd
          JOIN departments d ON d.id = sd.department_id
         WHERE sd.staff_id = sf.person_id
      )`.as("departments"),
    ])
    .orderBy("p.created_at", "desc")
    .limit(filters.limit + 1);

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    q = q.where((eb) =>
      eb.or([
        eb(sql`p.surname`, "ilike", term),
        eb(sql`p.given_names`, "ilike", term),
        eb(sql`sf.staff_number`, "ilike", term),
        eb(sql`p.school_email`, "ilike", term),
      ]),
    );
  }
  if (filters.status) q = q.where("sf.status", "=", filters.status);
  if (filters.adminsOnly) q = q.where("sr.staff_id", "is not", null);
  if (filters.departmentId) {
    q = q.where(({ exists, selectFrom }) =>
      exists(
        selectFrom("staff_departments as sd")
          .select(sql<number>`1`.as("x"))
          .whereRef("sd.staff_id", "=", "sf.person_id")
          .where("sd.department_id", "=", filters.departmentId!),
      ),
    );
  }
  if (filters.cursor) q = q.where("p.created_at", "<", new Date(filters.cursor));

  const rows = await q.execute();
  const hasMore = rows.length > filters.limit;
  const pageRows = hasMore ? rows.slice(0, filters.limit) : rows;
  const last = pageRows[pageRows.length - 1];

  return {
    rows: pageRows,
    nextCursor: hasMore && last ? new Date(last.created_at).toISOString() : null,
  };
}

export function findById(personId: string) {
  return db
    .selectFrom("staff as sf")
    .innerJoin("persons as p", "p.id", "sf.person_id")
    .leftJoin("staff_roles as sr", (join) =>
      join
        .onRef("sr.staff_id", "=", "sf.person_id")
        .on("sr.role", "=", "admin")
        .on("sr.revoked_on", "is", null),
    )
    .select([
      "sf.person_id",
      "sf.staff_number",
      "sf.job_title",
      "sf.employment_type",
      "sf.highest_qualification",
      "sf.hired_on",
      "sf.status",
      "sf.notes",
      "p.surname",
      "p.given_names",
      "p.sex",
      "p.phone",
      "p.phone_alt",
      "p.personal_email",
      "p.school_email",
      "p.preferred_language",
      "p.photo_key",
      "p.created_at",
      sql<boolean>`sr.staff_id IS NOT NULL`.as("is_admin"),
    ])
    .where("sf.person_id", "=", personId)
    .executeTakeFirst();
}

export type StaffPersonPatch = Partial<{
  surname: string;
  given_names: string;
  phone: string;
  phone_alt: string | null;
  personal_email: string | null;
  preferred_language: string;
}>;

export type StaffPatch = Partial<{
  staff_number: string | null;
  job_title: string | null;
  employment_type: string;
  highest_qualification: string | null;
  hired_on: string | null;
  status: string;
  notes: string | null;
}>;

export async function update(
  personId: string,
  person: StaffPersonPatch,
  staff: StaffPatch,
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    if (Object.keys(person).length > 0) {
      await trx.updateTable("persons").set(person).where("id", "=", personId).execute();
    }
    if (Object.keys(staff).length > 0) {
      await trx
        .updateTable("staff")
        .set(staff)
        .where("person_id", "=", personId)
        .execute();
    }
  });
}

/**
 * Retire a member of staff: mark them former, and revoke any admin grant.
 *
 * Not a delete. A lecturer who taught a class three years ago is named on
 * those results, and removing them would orphan the record of who marked
 * them. Revoking admin in the same transaction matters more than it looks:
 * somebody who has left must not keep the power to change fees.
 *
 * Their teaching assignments are left alone deliberately. Who taught what
 * is history, and history should not change because somebody resigned.
 */
export async function retire(personId: string): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("staff")
      .set({ status: "former" })
      .where("person_id", "=", personId)
      .execute();

    await trx
      .updateTable("staff_roles")
      .set({ revoked_on: new Date() })
      .where("staff_id", "=", personId)
      .where("revoked_on", "is", null)
      .execute();
  });
}

/** Grant admin. Idempotent: re-granting a live grant changes nothing. */
export async function grantAdmin(
  personId: string,
  grantedBy: string,
): Promise<void> {
  await db
    .insertInto("staff_roles")
    .values({ staff_id: personId, role: "admin", granted_by: grantedBy })
    .onConflict((oc) =>
      oc.columns(["staff_id", "role"]).doUpdateSet({
        revoked_on: null,
        granted_by: grantedBy,
        granted_on: new Date(),
      }),
    )
    .execute();
}

export async function revokeAdmin(personId: string): Promise<void> {
  await db
    .updateTable("staff_roles")
    .set({ revoked_on: new Date() })
    .where("staff_id", "=", personId)
    .where("role", "=", "admin")
    .where("revoked_on", "is", null)
    .execute();
}

/**
 * How many admins are left, not counting one person.
 *
 * Used to refuse the action that locks WIPEG out of its own system: the
 * last administrator revoking their own access, or retiring themselves.
 */
export async function otherLiveAdmins(excludingPersonId: string): Promise<number> {
  const row = await db
    .selectFrom("staff_roles as sr")
    .innerJoin("staff as sf", "sf.person_id", "sr.staff_id")
    .select(sql<number>`count(*)::int`.as("n"))
    .where("sr.role", "=", "admin")
    .where("sr.revoked_on", "is", null)
    .where("sf.status", "<>", "former")
    .where("sr.staff_id", "<>", excludingPersonId)
    .executeTakeFirst();

  return row?.n ?? 0;
}
