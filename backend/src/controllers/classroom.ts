import type { Request, Response } from "express";
import { z } from "zod";

import { ok } from "../lib/http.js";
import { logger } from "../lib/logger.js";
import * as audit from "../models/auditLog.js";
import * as model from "../models/classroom.js";
import { syncOffering } from "../services/google/classroom.js";

/**
 * The Classroom sync.
 *
 * Runs on a timer, and can also be pressed by an admin when they have just
 * enrolled somebody and do not want to wait. Both paths run the same code:
 * one button and one job that behave differently is a bug generator.
 *
 * Safe to run as often as you like. Courses are matched by a domain alias
 * derived from the offering id, and adding somebody already on the roster is
 * treated as success, so a second run in the same minute changes nothing.
 */

export const syncBody = z.object({
  /** Limit to one offering. Omitted, it does every active one. */
  offeringId: z.string().uuid().optional(),
  /** Safety valve for the first real run. */
  limit: z.number().int().min(1).max(500).default(200),
});

export async function sync(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as z.infer<typeof syncBody>;
  const started = Date.now();

  const all = await model.offeringsToSync(body.limit);
  const offerings = body.offeringId
    ? all.filter((o) => o.offering_id === body.offeringId)
    : all;

  const report = {
    offeringsConsidered: offerings.length,
    coursesCreated: 0,
    studentsAdded: 0,
    teachersAdded: 0,
    studentsWaitingForAnAccount: 0,
    failures: [] as { offeringId: string; course: string; error: string }[],
    problems: [] as { offeringId: string; email: string; error: string }[],
  };

  for (const offering of offerings) {
    const roster = await model.rosterFor(offering.offering_id);
    report.studentsWaitingForAnAccount += roster.studentsWithoutEmail;

    // An offering with nobody in it yet is not worth a Classroom. Skip it
    // rather than create an empty shell the registry has to tidy up later.
    if (roster.students.length === 0 && roster.teachers.length === 0) continue;

    try {
      const outcome = await syncOffering(
        {
          offeringId: offering.offering_id,
          courseTitle: offering.course_title,
          courseCode: offering.course_code,
          section: offering.section,
          room: offering.room,
        },
        roster,
      );

      if (outcome.courseCreated) report.coursesCreated += 1;
      report.studentsAdded += outcome.studentsAdded;
      report.teachersAdded += outcome.teachersAdded;
      for (const p of outcome.problems) {
        report.problems.push({ offeringId: offering.offering_id, ...p });
      }

      await model.recordCourseId(offering.offering_id, outcome.courseId);
    } catch (error) {
      // One offering failing must not stop the other hundred. Collect it and
      // carry on; the report names every one that did not work.
      logger.error("classroom sync failed for one offering", {
        offeringId: offering.offering_id,
        error,
      });
      report.failures.push({
        offeringId: offering.offering_id,
        course: `${offering.course_code} ${offering.section}`,
        error: "Google refused this one. See the server log.",
      });
    }
  }

  await audit.record(req.actor, {
    action: "sync_classroom",
    entity: "course_offerings",
    entityId: body.offeringId ?? null,
    summary:
      `Classroom sync: ${report.coursesCreated} course(s) created, ` +
      `${report.studentsAdded} student(s) and ${report.teachersAdded} teacher(s) added, ` +
      `${report.failures.length} offering(s) failed.`,
    after: report,
  });

  logger.info("classroom sync finished", {
    ...report,
    ms: Date.now() - started,
  });

  ok(res, report);
}
