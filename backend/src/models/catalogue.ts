import { query } from "../lib/db.js";

/**
 * What WIPEG offers: campuses, departments, specialisations, levels, awards.
 *
 * Layer 1 of the schema. Edited by hand once a year, read on every page of
 * the public website, and it knows nothing about any student. That is what
 * makes these the safe endpoints to open to the world.
 */

export type Campus = {
  id: string;
  code: string;
  name: string;
  region: string;
  phone: string | null;
  is_main: boolean;
};

export type Department = {
  id: string;
  slug: string;
  code: string;
  name: string;
};

export type Specialisation = {
  id: string;
  department_id: string;
  department_slug: string;
  code: string;
  name: string;
  online_available: boolean;
};

export type Level = {
  level: number;
  name: string;
  award_code: string;
  award_name: string;
  award_name_fr: string;
};

export function listCampuses(): Promise<Campus[]> {
  return query<Campus>(
    `SELECT id, code, name, region, phone, is_main
       FROM campuses
      WHERE is_active
      ORDER BY is_main DESC, name`,
  );
}

export function listDepartments(): Promise<Department[]> {
  return query<Department>(
    `SELECT id, slug, code, name
       FROM departments
      WHERE is_active
      ORDER BY name`,
  );
}

/** All of them, or just one department's, when `departmentSlug` is given. */
export function listSpecialisations(
  departmentSlug?: string | null,
): Promise<Specialisation[]> {
  return query<Specialisation>(
    `SELECT s.id,
            s.department_id,
            d.slug AS department_slug,
            s.code,
            s.name,
            s.online_available
       FROM specialisations s
       JOIN departments d ON d.id = s.department_id
      WHERE s.is_active
        AND d.is_active
        AND ($1::text IS NULL OR d.slug = $1)
      ORDER BY d.name, s.name`,
    [departmentSlug ?? null],
  );
}

export function listLevels(): Promise<Level[]> {
  return query<Level>(
    `SELECT l.level,
            l.name,
            a.code    AS award_code,
            a.name    AS award_name,
            a.name_fr AS award_name_fr
       FROM levels l
       JOIN awards a ON a.id = l.award_id
      ORDER BY l.level`,
  );
}

export async function departmentBySlug(
  slug: string,
): Promise<Department | null> {
  const rows = await query<Department>(
    `SELECT id, slug, code, name FROM departments WHERE slug = $1 AND is_active`,
    [slug],
  );
  return rows[0] ?? null;
}
