import type { Request, Response } from "express";
import { z } from "zod";

import { conflict, notFound } from "../lib/errors.js";
import { ok } from "../lib/http.js";
import { identityOf } from "../middleware/auth.js";
import * as audit from "../models/auditLog.js";
import * as results from "../models/results.js";

/**
 * The registry's results desk. Admin only.
 *
 * A lecturer enters marks and submits them; nothing reaches a student until
 * somebody here publishes. That second pair of eyes is the whole reason the
 * two steps are separate, and it is why publishing names who did it.
 */

/** Everything waiting to be released. */
export async function queue(_req: Request, res: Response): Promise<void> {
  const rows = await results.awaitingPublication();
  ok(res, {
    subjects: rows,
    note: rows.length === 0 ? "Nothing is waiting to be published." : null,
  });
}

/** Read one subject's marks before deciding. */
export async function review(req: Request, res: Response): Promise<void> {
  const offeringId = String(req.params.id ?? "");
  const label = await results.offeringLabel(offeringId);
  if (!label) throw notFound("That subject");

  ok(res, { subject: label, results: await results.submittedFor(offeringId) });
}

export const publishBody = z.object({
  /** Typed back by the admin, so publishing cannot be a misclick. */
  confirmCourseCode: z.string().trim().min(1).max(40),
});

/**
 * Release a subject's marks to its students.
 *
 * The course code has to be typed back. Publishing is the step a student
 * cannot un-see, and it is worth one deliberate action rather than a button
 * next to five others.
 */
export async function publish(req: Request, res: Response): Promise<void> {
  const me = identityOf(req);
  const offeringId = String(req.params.id ?? "");
  const body = req.body as z.infer<typeof publishBody>;

  const label = await results.offeringLabel(offeringId);
  if (!label) throw notFound("That subject");

  if (
    body.confirmCourseCode.toUpperCase() !== label.course_code.toUpperCase()
  ) {
    throw conflict(
      `To publish, type the course code exactly: ${label.course_code}`,
    );
  }

  const count = await results.publish(offeringId, me.personId);
  if (count === 0) {
    throw conflict(
      "Nothing to publish. Marks have to be submitted by the lecturer first.",
    );
  }

  await audit.record(req.actor, {
    action: "results_published",
    entity: "results",
    entityId: offeringId,
    summary: `PUBLISHED ${count} result(s) for ${label.course_code} ${label.course_title}, Level ${label.level}, ${label.campus}, ${label.term}.`,
  });

  ok(res, {
    published: count,
    subject: `${label.course_code} ${label.course_title}`,
    note: "Students can now see these.",
  });
}

export const returnBody = z.object({
  reason: z.string().trim().min(3).max(300),
});

/**
 * Send a subject back to the lecturer to correct.
 *
 * Only submitted marks go back. Published ones stay published: a student
 * has already read them, and quietly withdrawing a result is worse than
 * correcting it in the open.
 */
export async function returnToLecturer(
  req: Request,
  res: Response,
): Promise<void> {
  const offeringId = String(req.params.id ?? "");
  const { reason } = req.body as z.infer<typeof returnBody>;

  const label = await results.offeringLabel(offeringId);
  if (!label) throw notFound("That subject");

  const count = await results.returnToLecturer(offeringId);
  if (count === 0) {
    throw conflict(
      "Nothing to send back. Published results stay published — correct them in the open instead.",
    );
  }

  await audit.record(req.actor, {
    action: "results_returned",
    entity: "results",
    entityId: offeringId,
    summary: `Sent ${count} result(s) back to the lecturer for ${label.course_code}: ${reason}`,
  });

  ok(res, {
    returned: count,
    note: "The lecturer can edit these again. Students never saw them.",
  });
}
