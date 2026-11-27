import { db } from "../lib/db.js";

/**
 * What WIPEG offers: campuses, departments, specialisations, levels, awards.
 *
 * Layer 1 of the schema. Edited by hand once a year, read on every page of
 * the public website, and it knows nothing about any student — which is what
 * makes these the safe endpoints to open to the world.
 */

export function listCampuses() {
  return db
    .selectFrom("campuses")
    .select(["id", "code", "name", "region", "phone", "is_main"])
    .where("is_active", "=", true)
    .orderBy("is_main", "desc")
    .orderBy("name")
    .execute();
}

export function listDepartments() {
  return db
    .selectFrom("departments")
    .select(["id", "slug", "code", "name"])
    .where("is_active", "=", true)
    .orderBy("name")
    .execute();
}

/** All of them, or one department's when `departmentSlug` is given. */
export function listSpecialisations(departmentSlug?: string | null) {
  let q = db
    .selectFrom("specialisations as s")
    .innerJoin("departments as d", "d.id", "s.department_id")
    .select([
      "s.id",
      "s.department_id",
      "d.slug as department_slug",
      "s.code",
      "s.name",
      "s.online_available",
    ])
    .where("s.is_active", "=", true)
    .where("d.is_active", "=", true)
    .orderBy("d.name")
    .orderBy("s.name");

  if (departmentSlug) q = q.where("d.slug", "=", departmentSlug);

  return q.execute();
}

export function listLevels() {
  return db
    .selectFrom("levels as l")
    .innerJoin("awards as a", "a.id", "l.award_id")
    .select([
      "l.level",
      "l.name",
      "a.code as award_code",
      "a.name as award_name",
      "a.name_fr as award_name_fr",
    ])
    .orderBy("l.level")
    .execute();
}

export function departmentBySlug(slug: string) {
  return db
    .selectFrom("departments")
    .select(["id", "slug", "code", "name"])
    .where("slug", "=", slug)
    .where("is_active", "=", true)
    .executeTakeFirst();
}

export type Campus = Awaited<ReturnType<typeof listCampuses>>[number];
export type Department = Awaited<ReturnType<typeof listDepartments>>[number];
export type Specialisation = Awaited<
  ReturnType<typeof listSpecialisations>
>[number];
export type Level = Awaited<ReturnType<typeof listLevels>>[number];
