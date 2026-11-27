import { db, sql } from "../lib/db.js";

/**
 * Who the caller is. The only place the three-role rule is written in SQL.
 *
 *   Student   a row in `students`
 *   Lecturer  a row in `staff`
 *   Admin     a row in `staff` AND a live grant in `staff_roles`
 *
 * Being a lecturer is not granted, because it is simply what a staff row
 * means. `admin` is the one value `staff_roles.role` allows.
 */

export type Role = "admin" | "lecturer" | "student";

export type Identity = {
  personId: string;
  surname: string;
  givenNames: string;
  schoolEmail: string | null;
  photoKey: string | null;
  preferredLanguage: "en" | "fr";
  isStudent: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  matricule: string | null;
  staffNumber: string | null;
  jobTitle: string | null;
  /** Withdrawn, graduated, former — anything that should end portal access. */
  active: boolean;
};

/**
 * One query, reused by all three lookups.
 *
 * The three role flags are computed here rather than in TypeScript so that
 * the definition of "is an admin" lives in exactly one place. The join to
 * `staff_roles` carries the live-grant condition with it: a revoked grant
 * produces no row, so `is_admin` is false the moment it is revoked.
 */
function identityQuery() {
  return db
    .selectFrom("persons as p")
    .leftJoin("students as st", "st.person_id", "p.id")
    .leftJoin("staff as sf", "sf.person_id", "p.id")
    .leftJoin("staff_roles as sr", (join) =>
      join
        .onRef("sr.staff_id", "=", "sf.person_id")
        .on("sr.role", "=", "admin")
        .on("sr.revoked_on", "is", null),
    )
    .select([
      "p.id as person_id",
      "p.surname",
      "p.given_names",
      "p.school_email",
      "p.photo_key",
      "p.preferred_language",
      "st.matricule",
      "sf.staff_number",
      "sf.job_title",
      "st.status as student_status",
      "sf.status as staff_status",
      sql<boolean>`st.person_id IS NOT NULL`.as("is_student"),
      sql<boolean>`sf.person_id IS NOT NULL`.as("is_staff"),
      sql<boolean>`sr.staff_id IS NOT NULL`.as("is_admin"),
    ]);
}

type IdentityRow = Awaited<ReturnType<ReturnType<typeof identityQuery>["execute"]>>[number];

function toIdentity(row: IdentityRow): Identity {
  // A withdrawn student or a former member of staff keeps their record and
  // loses the portal. Decided here so no endpoint has to remember to check.
  const active =
    (row.is_student && row.student_status === "active") ||
    (row.is_staff && row.staff_status !== "former");

  return {
    personId: row.person_id,
    surname: row.surname,
    givenNames: row.given_names,
    schoolEmail: row.school_email,
    photoKey: row.photo_key,
    preferredLanguage: row.preferred_language as "en" | "fr",
    isStudent: row.is_student,
    isStaff: row.is_staff,
    isAdmin: row.is_admin,
    matricule: row.matricule,
    staffNumber: row.staff_number,
    jobTitle: row.job_title,
    active,
  };
}

export async function findByPersonId(
  personId: string,
): Promise<Identity | null> {
  const row = await identityQuery()
    .where("p.id", "=", personId)
    .executeTakeFirst();
  return row ? toIdentity(row) : null;
}

export async function findByGoogleSub(sub: string): Promise<Identity | null> {
  const row = await identityQuery()
    .where("p.google_sub", "=", sub)
    .executeTakeFirst();
  return row ? toIdentity(row) : null;
}

export async function findBySchoolEmail(
  email: string,
): Promise<Identity | null> {
  const row = await identityQuery()
    .where(sql`lower(p.school_email)`, "=", email.toLowerCase())
    .executeTakeFirst();
  return row ? toIdentity(row) : null;
}

/**
 * Bind a Google account to a person on first sign-in, and stamp the time.
 *
 * `google_sub` is written once and matched on afterwards, because an address
 * can be changed in the Admin console and Google's subject id cannot.
 */
export async function linkGoogleAccount(
  personId: string,
  googleSub: string,
  schoolEmail: string,
): Promise<void> {
  await db
    .updateTable("persons")
    .set({
      google_sub: googleSub,
      school_email: schoolEmail,
      last_signed_in_at: new Date(),
    })
    .where("id", "=", personId)
    .execute();
}

export async function stampSignIn(personId: string): Promise<void> {
  await db
    .updateTable("persons")
    .set({ last_signed_in_at: new Date() })
    .where("id", "=", personId)
    .execute();
}

/** Written onto the person once their Workspace account exists. */
export async function setSchoolEmail(
  personId: string,
  schoolEmail: string,
): Promise<void> {
  await db
    .updateTable("persons")
    .set({ school_email: schoolEmail })
    .where("id", "=", personId)
    .execute();
}

/** The role name used in the audit log and in error messages. */
export function primaryRole(identity: Identity): Role {
  if (identity.isAdmin) return "admin";
  if (identity.isStaff) return "lecturer";
  return "student";
}
