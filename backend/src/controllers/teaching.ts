import type { Request, Response } from "express";
import { z } from "zod";

import { conflict, notFound } from "../lib/errors.js";
import { created, ok } from "../lib/http.js";
import { identityOf } from "../middleware/auth.js";
import * as audit from "../models/auditLog.js";
import * as teaching from "../models/teaching.js";

/**
 * The lecturer portal.
 *
 * Every route here checks `teaches()` before doing anything with an
 * offering. A lecturer can reach their own classes and no others, and that
 * is enforced here rather than in the route file, because "does this person
 * teach this subject?" is a question only the database can answer.
 *
 * An admin is also staff, so an admin can use these too. That is deliberate:
 * somebody has to be able to fix a register when a lecturer is away.
 */

/** Confirm the caller teaches this offering, or treat it as non-existent. */
async function mine(req: Request, offeringId: string): Promise<string> {
  const me = identityOf(req);
  if (me.isAdmin) return me.personId;

  const allowed = await teaching.teaches(me.personId, offeringId);
  if (!allowed) {
    // Not found rather than forbidden: confirming a subject exists but is
    // somebody else's is itself a disclosure.
    throw notFound("That subject");
  }
  return me.personId;
}

export async function myTeaching(req: Request, res: Response): Promise<void> {
  const me = identityOf(req);
  const rows = await teaching.myOfferings(me.personId);
  ok(res, {
    subjects: rows,
    note: rows.length === 0 ? "You are not assigned to any subject this year." : null,
  });
}

export async function classList(req: Request, res: Response): Promise<void> {
  const offeringId = String(req.params.id ?? "");
  await mine(req, offeringId);
  ok(res, await teaching.classList(offeringId));
}

// ------------------------------------------------------------------ marks

export const marksBody = z.object({
  marks: z
    .array(
      z.object({
        enrolmentId: z.string().uuid(),
        caMark: z.number().min(0).max(100).nullable(),
        examMark: z.number().min(0).max(100).nullable(),
        remark: z.string().trim().max(200).nullish(),
      }),
    )
    .min(1)
    .max(300),
});

/**
 * Save marks. Draft only — nothing here reaches a student.
 *
 * Results already submitted or published are skipped rather than
 * overwritten, and the response says how many. A lecturer re-uploading last
 * term's spreadsheet must not quietly rewrite marks the registry released.
 */
export async function saveMarks(req: Request, res: Response): Promise<void> {
  const offeringId = String(req.params.id ?? "");
  const staffId = await mine(req, offeringId);
  const body = req.body as z.infer<typeof marksBody>;

  const result = await teaching.saveMarks(
    offeringId,
    staffId,
    body.marks.map((m) => ({
      enrolmentId: m.enrolmentId,
      caMark: m.caMark,
      examMark: m.examMark,
      remark: m.remark ?? null,
    })),
  );

  await audit.record(req.actor, {
    action: "marks_saved",
    entity: "results",
    entityId: offeringId,
    summary: `Saved ${result.saved} mark(s) as draft; ${result.lockedCount} already submitted or published and left alone.`,
  });

  ok(res, {
    ...result,
    note:
      result.lockedCount > 0
        ? `${result.lockedCount} result(s) were already submitted or published and were not changed.`
        : "Saved as draft. Students cannot see these yet.",
  });
}

/**
 * Hand the marks to the registry.
 *
 * Only results with an exam mark go, because a blank row is not a result.
 * After this the lecturer can no longer edit them: the registry needs to be
 * reviewing a fixed set, not one still moving under them.
 */
export async function submitMarks(req: Request, res: Response): Promise<void> {
  const offeringId = String(req.params.id ?? "");
  await mine(req, offeringId);

  const count = await teaching.submitMarks(offeringId);
  if (count === 0) {
    throw conflict(
      "Nothing to submit. Marks need an exam mark, and anything already submitted stays as it is.",
    );
  }

  await audit.record(req.actor, {
    action: "marks_submitted",
    entity: "results",
    entityId: offeringId,
    summary: `Submitted ${count} result(s) to the registry for publishing.`,
  });

  ok(res, {
    submitted: count,
    note: "Sent to the registry. You can no longer edit these; students still cannot see them.",
  });
}

// ------------------------------------------------------------- attendance

export const sessionBody = z.object({
  heldOn: z.string().date(),
  startsAt: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  endsAt: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  topic: z.string().trim().max(200).nullish(),
});

export async function listSessions(req: Request, res: Response): Promise<void> {
  const offeringId = String(req.params.id ?? "");
  await mine(req, offeringId);
  ok(res, await teaching.sessionsFor(offeringId));
}

export async function createSession(req: Request, res: Response): Promise<void> {
  const offeringId = String(req.params.id ?? "");
  const staffId = await mine(req, offeringId);
  const body = req.body as z.infer<typeof sessionBody>;

  const session = await teaching.createSession({
    offeringId,
    heldOn: body.heldOn,
    startsAt: body.startsAt ?? null,
    endsAt: body.endsAt ?? null,
    topic: body.topic ?? null,
    staffId,
  });

  await audit.record(req.actor, {
    action: "class_session_created",
    entity: "class_sessions",
    entityId: session.id,
    summary: `Opened a register for ${body.heldOn}${body.topic ? ` (${body.topic})` : ""}.`,
  });

  created(res, session);
}

export const attendanceBody = z.object({
  entries: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        status: z.enum(["present", "absent", "late", "excused"]),
        note: z.string().trim().max(200).nullish(),
      }),
    )
    .min(1)
    .max(300),
});

export async function readRegister(req: Request, res: Response): Promise<void> {
  const sessionId = String(req.params.sessionId ?? "");
  const session = await teaching.findSession(sessionId);
  if (!session) throw notFound("That class session");
  await mine(req, session.course_offering_id);

  ok(res, { session, students: await teaching.attendanceFor(sessionId) });
}

/** Mark the register. Re-marking a student replaces the earlier entry. */
export async function markRegister(req: Request, res: Response): Promise<void> {
  const sessionId = String(req.params.sessionId ?? "");
  const session = await teaching.findSession(sessionId);
  if (!session) throw notFound("That class session");

  const staffId = await mine(req, session.course_offering_id);
  const body = req.body as z.infer<typeof attendanceBody>;

  const count = await teaching.markAttendance(
    sessionId,
    staffId,
    body.entries.map((e) => ({
      studentId: e.studentId,
      status: e.status,
      note: e.note ?? null,
    })),
  );

  await audit.record(req.actor, {
    action: "attendance_marked",
    entity: "attendance",
    entityId: sessionId,
    // `held_on` arrives as a Date, and String(date).slice(0,10) gives
    // "Fri Nov 20" rather than the date. Format it properly.
    summary: `Marked ${count} student(s) for the session on ${new Date(session.held_on).toISOString().slice(0, 10)}.`,
  });

  ok(res, { marked: count });
}
