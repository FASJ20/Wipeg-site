import type { Request, Response } from "express";
import { z } from "zod";

import { conflict, notFound } from "../lib/errors.js";
import { ok, page } from "../lib/http.js";
import { identityOf } from "../middleware/auth.js";
import { queryOf } from "../middleware/validate.js";
import * as audit from "../models/auditLog.js";
import * as staff from "../models/staff.js";

/**
 * Staff records, for the administration.
 *
 * Same shape as the student records: list, read, correct, and a `retire`
 * that marks somebody former rather than deleting them.
 *
 * The one thing here that has no equivalent on the student side is granting
 * admin. That is the most consequential action in the whole system — it
 * hands somebody every student record and every fee — so it is its own
 * endpoint, logged in capitals, and guarded against locking WIPEG out.
 */

const PHONE = /^\+[0-9]{8,15}$/;

export const listQuery = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  departmentId: z.string().uuid().optional(),
  status: z.enum(["active", "on_leave", "former"]).optional(),
  adminsOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().datetime().optional(),
});

export async function list(req: Request, res: Response): Promise<void> {
  const q = queryOf<z.infer<typeof listQuery>>(req);
  const result = await staff.list({
    search: q.search ?? null,
    departmentId: q.departmentId ?? null,
    status: q.status ?? null,
    adminsOnly: q.adminsOnly ?? false,
    limit: q.limit,
    cursor: q.cursor ?? null,
  });
  page(res, result.rows, result.nextCursor);
}

export async function detail(req: Request, res: Response): Promise<void> {
  const row = await staff.findById(String(req.params.id ?? ""));
  if (!row) throw notFound("That member of staff");
  ok(res, row);
}

export const patchBody = z
  .object({
    surname: z.string().trim().min(1).max(120).optional(),
    givenNames: z.string().trim().min(1).max(160).optional(),
    phone: z.string().trim().regex(PHONE).optional(),
    phoneAlt: z.string().trim().regex(PHONE).nullish(),
    personalEmail: z.string().trim().toLowerCase().email().max(200).nullish(),
    preferredLanguage: z.enum(["en", "fr"]).optional(),

    staffNumber: z.string().trim().min(1).max(40).nullish(),
    jobTitle: z.string().trim().max(120).nullish(),
    employmentType: z.enum(["permanent", "part_time", "visiting"]).optional(),
    highestQualification: z.string().trim().max(80).nullish(),
    hiredOn: z.string().date().nullish(),
    status: z.enum(["active", "on_leave", "former"]).optional(),
    notes: z.string().trim().max(2000).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to change." });

export async function update(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id ?? "");
  const body = req.body as z.infer<typeof patchBody>;

  const before = await staff.findById(id);
  if (!before) throw notFound("That member of staff");

  const person: staff.StaffPersonPatch = {};
  const record: staff.StaffPatch = {};

  if (body.surname !== undefined) person.surname = body.surname;
  if (body.givenNames !== undefined) person.given_names = body.givenNames;
  if (body.phone !== undefined) person.phone = body.phone;
  if (body.phoneAlt !== undefined) person.phone_alt = body.phoneAlt ?? null;
  if (body.personalEmail !== undefined) person.personal_email = body.personalEmail ?? null;
  if (body.preferredLanguage !== undefined) person.preferred_language = body.preferredLanguage;

  if (body.staffNumber !== undefined) record.staff_number = body.staffNumber ?? null;
  if (body.jobTitle !== undefined) record.job_title = body.jobTitle ?? null;
  if (body.employmentType !== undefined) record.employment_type = body.employmentType;
  if (body.highestQualification !== undefined) {
    record.highest_qualification = body.highestQualification ?? null;
  }
  if (body.hiredOn !== undefined) record.hired_on = body.hiredOn ?? null;
  if (body.status !== undefined) record.status = body.status;
  if (body.notes !== undefined) record.notes = body.notes ?? null;

  await staff.update(id, person, record);

  await audit.record(req.actor, {
    action: "staff_updated",
    entity: "staff",
    entityId: id,
    summary: `Updated ${before.given_names} ${before.surname}: ${Object.keys(body).join(", ")}`,
    after: body,
  });

  ok(res, await staff.findById(id));
}

export const retireBody = z.object({
  reason: z.string().trim().min(3).max(300),
});

/**
 * Retire somebody. Marks them former and revokes any admin grant.
 *
 * Nothing is deleted: a lecturer who taught a class three years ago is
 * named on those results, and removing them would orphan the record of who
 * marked them. Their teaching history stays exactly as it was, because
 * history should not change when somebody resigns.
 *
 * Refused if they are the last administrator. Letting WIPEG lock itself out
 * of its own records is not a decision an API should allow by accident.
 */
export async function retire(req: Request, res: Response): Promise<void> {
  const me = identityOf(req);
  const id = String(req.params.id ?? "");
  const { reason } = req.body as z.infer<typeof retireBody>;

  const before = await staff.findById(id);
  if (!before) throw notFound("That member of staff");
  if (before.status === "former") {
    throw conflict("They have already been retired.");
  }

  if (before.is_admin && (await staff.otherLiveAdmins(id)) === 0) {
    throw conflict(
      "This is the last administrator. Grant admin to somebody else first, or WIPEG will be locked out of its own records.",
    );
  }

  await staff.retire(id);

  await audit.record(req.actor, {
    action: "staff_retired",
    entity: "staff",
    entityId: id,
    summary:
      `Retired ${before.given_names} ${before.surname}` +
      (before.is_admin ? " AND REVOKED THEIR ADMIN ACCESS" : "") +
      `: ${reason}`,
    before: { status: before.status, is_admin: before.is_admin },
    after: { status: "former", is_admin: false, reason },
  });

  void me;
  ok(res, {
    person_id: id,
    status: "former",
    note: "The record is kept. Their teaching history and the results they marked are untouched.",
  });
}

// ------------------------------------------------------------ admin grants

export const grantBody = z.object({
  reason: z.string().trim().min(3).max(300),
});

/**
 * Grant admin.
 *
 * The most consequential action in this system: it hands somebody every
 * student record, every fee and the ability to grant it to others. Logged
 * in capitals so it stands out in a page of routine edits.
 */
export async function grantAdmin(req: Request, res: Response): Promise<void> {
  const me = identityOf(req);
  const id = String(req.params.id ?? "");
  const { reason } = req.body as z.infer<typeof grantBody>;

  const target = await staff.findById(id);
  if (!target) throw notFound("That member of staff");
  if (target.status === "former") {
    throw conflict("They have been retired. Reactivate them first.");
  }
  if (target.is_admin) throw conflict("They are already an administrator.");

  await staff.grantAdmin(id, me.personId);

  await audit.record(req.actor, {
    action: "admin_granted",
    entity: "staff_roles",
    entityId: id,
    summary: `ADMIN GRANTED to ${target.given_names} ${target.surname} (${target.school_email ?? "no school email"}): ${reason}`,
  });

  ok(res, { person_id: id, is_admin: true });
}

/**
 * Revoke admin.
 *
 * Refused for the last administrator, including when that is the caller
 * themselves — the commonest way to lock an institution out of its own
 * system is one person tidying up their own permissions.
 */
export async function revokeAdmin(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id ?? "");
  const { reason } = req.body as z.infer<typeof grantBody>;

  const target = await staff.findById(id);
  if (!target) throw notFound("That member of staff");
  if (!target.is_admin) throw conflict("They are not an administrator.");

  if ((await staff.otherLiveAdmins(id)) === 0) {
    throw conflict(
      "This is the last administrator. Grant admin to somebody else first.",
    );
  }

  await staff.revokeAdmin(id);

  await audit.record(req.actor, {
    action: "admin_revoked",
    entity: "staff_roles",
    entityId: id,
    summary: `ADMIN REVOKED from ${target.given_names} ${target.surname}: ${reason}`,
  });

  ok(res, { person_id: id, is_admin: false });
}
