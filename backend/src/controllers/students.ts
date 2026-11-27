import type { Request, Response } from "express";
import { z } from "zod";

import { conflict, notAuthorised, notFound } from "../lib/errors.js";
import { ok, page } from "../lib/http.js";
import { identityOf } from "../middleware/auth.js";
import { queryOf } from "../middleware/validate.js";
import * as audit from "../models/auditLog.js";
import * as students from "../models/students.js";

/**
 * Student records, as the registry works with them.
 *
 * Separate from controllers/student.ts, which is a student's own view.
 * Everything here can reach anybody, so everything here is behind a staff
 * guard, and most of it behind an admin guard.
 */

const PHONE = /^\+[0-9]{8,15}$/;

export const listQuery = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  campusId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  level: z.coerce.number().int().min(1).max(5).optional(),
  status: z.enum(["active", "graduated", "withdrawn", "deceased"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().datetime().optional(),
});

export async function list(req: Request, res: Response): Promise<void> {
  const q = queryOf<z.infer<typeof listQuery>>(req);
  const result = await students.list({
    search: q.search ?? null,
    campusId: q.campusId ?? null,
    departmentId: q.departmentId ?? null,
    level: q.level ?? null,
    status: q.status ?? null,
    limit: q.limit,
    cursor: q.cursor ?? null,
  });
  page(res, result.rows, result.nextCursor);
}

/**
 * One student.
 *
 * An admin gets the whole record. A lecturer gets name, matricule and photo,
 * and only for a student they actually teach — enough to mark a register and
 * know they have the right person, and nothing about fees, documents,
 * address or guardian.
 */
export async function detail(req: Request, res: Response): Promise<void> {
  const me = identityOf(req);
  const id = String(req.params.id ?? "");

  if (me.isAdmin) {
    const row = await students.findById(id);
    if (!row) throw notFound("That student");
    ok(res, row);
    return;
  }

  const teaches = await students.lecturerTeaches(me.personId, id);
  if (!teaches) {
    // Deliberately "not found" rather than "not allowed": telling a lecturer
    // that a student exists but is not theirs is itself a disclosure.
    throw notFound("That student");
  }

  const basics = await students.findBasics(id);
  if (!basics) throw notFound("That student");
  ok(res, { ...basics, view: "basics" });
}

export const patchBody = z
  .object({
    surname: z.string().trim().min(1).max(120).optional(),
    givenNames: z.string().trim().min(1).max(160).optional(),
    nameOnId: z.string().trim().min(1).max(200).optional(),
    sex: z.enum(["female", "male", "other"]).nullish(),
    dateOfBirth: z.string().date().nullish(),
    placeOfBirth: z.string().trim().max(160).nullish(),
    nationality: z.string().trim().max(80).optional(),
    phone: z.string().trim().regex(PHONE).optional(),
    phoneAlt: z.string().trim().regex(PHONE).nullish(),
    personalEmail: z.string().trim().toLowerCase().email().max(200).nullish(),
    preferredLanguage: z.enum(["en", "fr"]).optional(),
    addressTown: z.string().trim().max(120).nullish(),
    addressDetail: z.string().trim().max(400).nullish(),

    matricule: z.string().trim().min(1).max(40).nullish(),
    guardianName: z.string().trim().min(1).max(160).optional(),
    guardianPhone: z.string().trim().regex(PHONE).optional(),
    guardianRelation: z.string().trim().max(60).nullish(),
    status: z.enum(["active", "graduated", "withdrawn", "deceased"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Nothing to change.",
  });

/**
 * Correct a student record.
 *
 * Admins may change any field: names get misspelled, phones change, and a
 * registry that cannot fix a typo creates worse workarounds than the typo.
 *
 * Two fields are singled out. A matricule and a date of birth are what
 * identify a person on a certificate, so changing either writes its own loud
 * audit entry naming the old and new value, on top of the ordinary one. The
 * change is allowed; it is simply impossible to make quietly.
 */
export async function update(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id ?? "");
  const body = req.body as z.infer<typeof patchBody>;

  const before = await students.findById(id);
  if (!before) throw notFound("That student");

  const person: students.PersonPatch = {};
  const student: students.StudentPatch = {};

  if (body.surname !== undefined) person.surname = body.surname;
  if (body.givenNames !== undefined) person.given_names = body.givenNames;
  if (body.nameOnId !== undefined) person.name_on_id = body.nameOnId;
  if (body.sex !== undefined) person.sex = body.sex ?? null;
  if (body.dateOfBirth !== undefined) person.date_of_birth = body.dateOfBirth ?? null;
  if (body.placeOfBirth !== undefined) person.place_of_birth = body.placeOfBirth ?? null;
  if (body.nationality !== undefined) person.nationality = body.nationality;
  if (body.phone !== undefined) person.phone = body.phone;
  if (body.phoneAlt !== undefined) person.phone_alt = body.phoneAlt ?? null;
  if (body.personalEmail !== undefined) person.personal_email = body.personalEmail ?? null;
  if (body.preferredLanguage !== undefined) person.preferred_language = body.preferredLanguage;
  if (body.addressTown !== undefined) person.address_town = body.addressTown ?? null;
  if (body.addressDetail !== undefined) person.address_detail = body.addressDetail ?? null;

  if (body.matricule !== undefined) student.matricule = body.matricule ?? null;
  if (body.guardianName !== undefined) student.guardian_name = body.guardianName;
  if (body.guardianPhone !== undefined) student.guardian_phone = body.guardianPhone;
  if (body.guardianRelation !== undefined) student.guardian_relation = body.guardianRelation ?? null;
  if (body.status !== undefined) student.status = body.status;

  await students.update(id, person, student);

  const name = `${before.given_names} ${before.surname}`;

  // The loud one, first, so it is not buried under a routine edit.
  const identityChanges: string[] = [];
  if (body.matricule !== undefined && body.matricule !== before.matricule) {
    identityChanges.push(
      `matricule ${before.matricule ?? "(none)"} -> ${body.matricule ?? "(none)"}`,
    );
  }
  const beforeDob = before.date_of_birth
    ? new Date(before.date_of_birth).toISOString().slice(0, 10)
    : null;
  if (body.dateOfBirth !== undefined && (body.dateOfBirth ?? null) !== beforeDob) {
    identityChanges.push(
      `date of birth ${beforeDob ?? "(none)"} -> ${body.dateOfBirth ?? "(none)"}`,
    );
  }

  if (identityChanges.length > 0) {
    await audit.record(req.actor, {
      action: "student_identity_changed",
      entity: "students",
      entityId: id,
      summary: `IDENTITY CHANGED for ${name}: ${identityChanges.join("; ")}`,
      before: { matricule: before.matricule, date_of_birth: beforeDob },
      after: { matricule: body.matricule, date_of_birth: body.dateOfBirth },
    });
  }

  await audit.record(req.actor, {
    action: "student_updated",
    entity: "students",
    entityId: id,
    summary: `Updated ${name}: ${Object.keys(body).join(", ")}`,
    after: body,
  });

  ok(res, await students.findById(id));
}

export const withdrawBody = z.object({
  reason: z.string().trim().min(3).max(300),
});

/**
 * Remove a student from the roll.
 *
 * Marks them withdrawn and closes their enrolment. Nothing is deleted: a
 * student who leaves in October may be back in February, and a removed
 * record takes their transcript and the history of every franc they paid
 * with it. The database would refuse a real delete anyway.
 */
export async function withdraw(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id ?? "");
  const { reason } = req.body as z.infer<typeof withdrawBody>;

  const before = await students.findById(id);
  if (!before) throw notFound("That student");
  if (before.status === "withdrawn") {
    throw conflict("That student is already withdrawn.");
  }

  await students.withdraw(id, reason);

  await audit.record(req.actor, {
    action: "student_withdrawn",
    entity: "students",
    entityId: id,
    summary: `Withdrew ${before.given_names} ${before.surname} (${before.matricule ?? "no matricule"}): ${reason}`,
    before: { status: before.status },
    after: { status: "withdrawn", reason },
  });

  ok(res, {
    person_id: id,
    status: "withdrawn",
    note: "The record is kept. Results, fees and documents are untouched.",
  });
}

export async function reinstate(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id ?? "");

  const before = await students.findById(id);
  if (!before) throw notFound("That student");
  if (before.status === "active") {
    throw conflict("That student is already active.");
  }

  await students.reinstate(id);

  await audit.record(req.actor, {
    action: "student_reinstated",
    entity: "students",
    entityId: id,
    summary: `Reinstated ${before.given_names} ${before.surname} (was ${before.status}).`,
  });

  ok(res, {
    person_id: id,
    status: "active",
    note: "They will need enrolling into a class again.",
  });
}

/** Guards the lecturer path; admins never reach it. */
export function assertStaff(req: Request): void {
  const me = identityOf(req);
  if (!me.isStaff) throw notAuthorised("Only staff can do this.");
}
