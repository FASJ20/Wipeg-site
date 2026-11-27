import type { Request, Response } from "express";

import { notAuthorised } from "../lib/errors.js";
import { ok } from "../lib/http.js";
import { identityOf } from "../middleware/auth.js";
import type { Identity } from "../models/identity.js";
import * as student from "../models/student.js";

/**
 * The student's own view of themselves.
 *
 * Every function here reads the student id from the session and nowhere
 * else. No address in this file takes a student id, so there is no way to
 * ask for somebody else's record — not by changing a URL, not by editing a
 * request body. That is the whole security model of the portal, and it is
 * worth more than any permission check I could add on top.
 */

function meAsStudent(req: Request): Identity {
  const me = identityOf(req);
  if (!me.isStudent) {
    throw notAuthorised("This is the student portal.");
  }
  return me;
}

/** Class, level, campus, and whether they study on campus or online. */
export async function enrolment(req: Request, res: Response): Promise<void> {
  const me = meAsStudent(req);
  const row = await student.enrolment(me.personId);

  ok(res, {
    matricule: me.matricule,
    enrolment: row ?? null,
    // Said plainly rather than returning an empty object. A registered
    // student who has not been placed in a class yet is a normal state, and
    // the portal should be able to explain it.
    note: row
      ? null
      : "You are not enrolled in a class yet. The registry will place you.",
  });
}

export async function subjects(req: Request, res: Response): Promise<void> {
  const me = meAsStudent(req);
  ok(res, await student.subjects(me.personId));
}

/** Published results, with the running average. */
export async function results(req: Request, res: Response): Promise<void> {
  const me = meAsStudent(req);
  const [rows, average] = await Promise.all([
    student.results(me.personId),
    student.gradePointAverage(me.personId),
  ]);

  ok(res, {
    results: rows,
    average,
    note:
      rows.length === 0
        ? "No results have been published yet."
        : null,
  });
}

export async function attendance(req: Request, res: Response): Promise<void> {
  const me = meAsStudent(req);
  const rows = await student.attendance(me.personId);
  ok(res, {
    subjects: rows,
    note: rows.length === 0 ? "No attendance has been recorded yet." : null,
  });
}

/** What is owed, what has been paid, and the receipts behind it. */
export async function fees(req: Request, res: Response): Promise<void> {
  const me = meAsStudent(req);
  const data = await student.fees(me.personId);

  ok(res, {
    ...data,
    currency: "XAF",
    // Said here because it is the single most common misunderstanding: this
    // system records money, it never takes it.
    note: "Fees are paid at the bursary. This page only shows what has been recorded.",
  });
}

export async function documents(req: Request, res: Response): Promise<void> {
  const me = meAsStudent(req);
  ok(res, await student.documents(me.personId));
}
