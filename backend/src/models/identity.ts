import { query, queryOne } from "../lib/db.js";

/**
 * Who the caller is. The only place the three-role rule is expressed in SQL.
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
  /** Suspended, graduated, former — anything that should end portal access. */
  active: boolean;
};

type IdentityRow = {
  person_id: string;
  surname: string;
  given_names: string;
  school_email: string | null;
  photo_key: string | null;
  preferred_language: "en" | "fr";
  is_student: boolean;
  is_staff: boolean;
  is_admin: boolean;
  matricule: string | null;
  staff_number: string | null;
  job_title: string | null;
  student_status: string | null;
  staff_status: string | null;
};

const IDENTITY_SELECT = `
  SELECT
    p.id                         AS person_id,
    p.surname,
    p.given_names,
    p.school_email,
    p.photo_key,
    p.preferred_language,
    (st.person_id IS NOT NULL)   AS is_student,
    (sf.person_id IS NOT NULL)   AS is_staff,
    (sr.staff_id  IS NOT NULL)   AS is_admin,
    st.matricule,
    sf.staff_number,
    sf.job_title,
    st.status                    AS student_status,
    sf.status                    AS staff_status
  FROM persons p
  LEFT JOIN students st ON st.person_id = p.id
  LEFT JOIN staff    sf ON sf.person_id = p.id
  LEFT JOIN staff_roles sr
         ON sr.staff_id = sf.person_id
        AND sr.role = 'admin'
        AND sr.revoked_on IS NULL
`;

function toIdentity(row: IdentityRow): Identity {
  // A withdrawn student or a former member of staff keeps their record but
  // loses the portal. Checked here so no endpoint has to remember to.
  const active =
    (row.is_student && row.student_status === "active") ||
    (row.is_staff && row.staff_status !== "former");

  return {
    personId: row.person_id,
    surname: row.surname,
    givenNames: row.given_names,
    schoolEmail: row.school_email,
    photoKey: row.photo_key,
    preferredLanguage: row.preferred_language,
    isStudent: row.is_student,
    isStaff: row.is_staff,
    isAdmin: row.is_admin,
    matricule: row.matricule,
    staffNumber: row.staff_number,
    jobTitle: row.job_title,
    active,
  };
}

export async function findByPersonId(personId: string): Promise<Identity | null> {
  const row = await queryOne<IdentityRow>(
    `${IDENTITY_SELECT} WHERE p.id = $1`,
    [personId],
  );
  return row ? toIdentity(row) : null;
}

export async function findByGoogleSub(sub: string): Promise<Identity | null> {
  const row = await queryOne<IdentityRow>(
    `${IDENTITY_SELECT} WHERE p.google_sub = $1`,
    [sub],
  );
  return row ? toIdentity(row) : null;
}

export async function findBySchoolEmail(email: string): Promise<Identity | null> {
  const row = await queryOne<IdentityRow>(
    `${IDENTITY_SELECT} WHERE lower(p.school_email) = lower($1)`,
    [email],
  );
  return row ? toIdentity(row) : null;
}

/**
 * Bind a Google account to a person on first sign-in, and stamp the time.
 *
 * `google_sub` is written once and then matched on afterwards, because an
 * address can be changed in the Admin console and Google's subject id cannot.
 */
export async function linkGoogleAccount(
  personId: string,
  googleSub: string,
  schoolEmail: string,
): Promise<void> {
  await query(
    `UPDATE persons
        SET google_sub        = $2,
            school_email      = $3,
            last_signed_in_at = now()
      WHERE id = $1`,
    [personId, googleSub, schoolEmail],
  );
}

export async function stampSignIn(personId: string): Promise<void> {
  await query(`UPDATE persons SET last_signed_in_at = now() WHERE id = $1`, [
    personId,
  ]);
}

/** Written onto the person record once the Workspace account is created. */
export async function setSchoolEmail(
  personId: string,
  schoolEmail: string,
): Promise<void> {
  await query(`UPDATE persons SET school_email = $2 WHERE id = $1`, [
    personId,
    schoolEmail,
  ]);
}

/** The role name used in the audit log and in error messages. */
export function primaryRole(identity: Identity): Role {
  if (identity.isAdmin) return "admin";
  if (identity.isStaff) return "lecturer";
  return "student";
}
