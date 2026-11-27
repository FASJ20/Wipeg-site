import { requireServiceAccount } from "../../lib/env.js";
import { upstreamFailed } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { googleFetch, googleFetchRaw, SCOPES } from "./serviceAccount.js";

/**
 * Google Classroom, created and populated from the records WIPEG already keeps.
 *
 * One Classroom course per `course_offerings` row — one subject, taught to
 * one class, in one term. Not one per class: a Level 2 Software Engineering
 * cohort takes six subjects with different lecturers, and those are six
 * Classrooms, which is how Classroom is meant to be used.
 *
 * Four facts from Google's documentation shape everything below. Each one is
 * a day lost if you find it the hard way.
 *
 *   1. A domain administrator may add students and teachers DIRECTLY, with no
 *      invitation to accept, as long as both the person and the course owner
 *      are inside the domain. That is why the service account impersonates a
 *      super admin, and why no student ever has to click anything.
 *
 *   2. A course created without an explicit state is PROVISIONED, not ACTIVE
 *      — which means invisible to students. Every create below sets
 *      courseState explicitly.
 *
 *   3. A course can be created with an ALIAS as its id. That is the whole
 *      idempotency story: the alias is derived from the offering's uuid, so
 *      asking for it twice finds the same course instead of making a second.
 *
 *   4. Adding somebody who is already on the roster returns ALREADY_EXISTS.
 *      That is success, not failure, and is treated as such — otherwise the
 *      sync can never be re-run, and a sync that cannot be re-run is useless.
 */

const CLASSROOM_API = "https://classroom.googleapis.com/v1";

/**
 * Domain-scoped alias for an offering.
 *
 * `d:` means domain-scoped, which requires an admin caller and makes the
 * alias unique across WIPEG rather than per-Cloud-project. Deriving it from
 * the offering id means the mapping survives this database being restored
 * from a backup with the google_course_id column empty.
 */
export function aliasFor(offeringId: string): string {
  return `d:wipeg-offering-${offeringId}`;
}

export type CourseDescriptor = {
  offeringId: string;
  /** "Software Engineering" */
  courseTitle: string;
  /** "CEN-SWE-201" or whatever the registry uses. */
  courseCode: string;
  /** "Level 2 Software Engineering — Garoua" */
  section: string;
  /** "First semester 2026/2027" */
  room: string;
};

type ClassroomCourse = {
  id: string;
  name?: string;
  courseState?: string;
  alternateLink?: string;
};

function isAlreadyExists(status: number, json: unknown): boolean {
  if (status === 409) return true;
  // Classroom reports it as 400 ALREADY_EXISTS in some paths rather than 409.
  const message =
    typeof json === "object" && json !== null && "error" in json
      ? JSON.stringify((json as { error: unknown }).error)
      : "";
  return message.includes("ALREADY_EXISTS");
}

/**
 * Create the Classroom course for an offering, or return the existing one.
 *
 * The owner is the impersonated admin rather than the lecturer, deliberately.
 * A create fails outright if the named owner is not able to own a course —
 * no Classroom access, licence not assigned, account not yet verified as a
 * teacher — and a lecturer hired last week is exactly the person that would
 * happen to. The admin can always own one, the lecturer is added as a teacher
 * immediately afterwards with every right that matters (post, grade, invite),
 * and ownership can be transferred later in the Classroom UI if WIPEG wants.
 */
export async function ensureCourse(
  descriptor: CourseDescriptor,
): Promise<{ courseId: string; link: string | null; created: boolean }> {
  const { impersonatedAdmin } = requireServiceAccount();
  const alias = aliasFor(descriptor.offeringId);

  const created = await googleFetchRaw(
    SCOPES.classroom,
    `${CLASSROOM_API}/courses`,
    {
      method: "POST",
      service: "Google Classroom",
      body: {
        id: alias,
        name: `${descriptor.courseTitle} — ${descriptor.section}`,
        section: descriptor.section,
        descriptionHeading: descriptor.courseCode,
        room: descriptor.room,
        ownerId: impersonatedAdmin,
        // Explicit, because the default is PROVISIONED and students cannot
        // see a PROVISIONED course.
        courseState: "ACTIVE",
      },
    },
  );

  if (created.ok) {
    const course = created.json as ClassroomCourse;
    logger.info("classroom course created", {
      offeringId: descriptor.offeringId,
      courseId: course.id,
    });
    return {
      courseId: course.id,
      link: course.alternateLink ?? null,
      created: true,
    };
  }

  if (!isAlreadyExists(created.status, created.json)) {
    throw upstreamFailed("Google Classroom", {
      status: created.status,
      json: created.json,
      offeringId: descriptor.offeringId,
    });
  }

  // Already there. Fetch it by the same alias to get its real id.
  const existing = await googleFetch<ClassroomCourse>(
    SCOPES.classroom,
    `${CLASSROOM_API}/courses/${encodeURIComponent(alias)}`,
    { service: "Google Classroom" },
  );

  return {
    courseId: existing.id,
    link: existing.alternateLink ?? null,
    created: false,
  };
}

type RosterOutcome = { email: string; added: boolean; error: string | null };

async function addToRoster(
  courseId: string,
  email: string,
  role: "students" | "teachers",
): Promise<RosterOutcome> {
  const result = await googleFetchRaw(
    SCOPES.classroom,
    `${CLASSROOM_API}/courses/${encodeURIComponent(courseId)}/${role}`,
    { method: "POST", service: "Google Classroom", body: { userId: email } },
  );

  if (result.ok) return { email, added: true, error: null };

  // Already on the roster. The desired state holds, so this is success.
  if (isAlreadyExists(result.status, result.json)) {
    return { email, added: false, error: null };
  }

  // One bad address must not abandon the other thirty-nine students, so the
  // failure is returned rather than thrown. The caller reports them together.
  const detail =
    result.status === 404
      ? "no Google account for this address"
      : `Google refused this (HTTP ${result.status})`;

  logger.warn("classroom roster add failed", {
    courseId,
    role,
    email,
    status: result.status,
  });

  return { email, added: false, error: detail };
}

export type SyncOutcome = {
  courseId: string;
  link: string | null;
  courseCreated: boolean;
  studentsAdded: number;
  teachersAdded: number;
  problems: { email: string; error: string }[];
};

/**
 * Bring one offering's Classroom into line with the database.
 *
 * Additive only: it never removes anybody. A student who withdraws is removed
 * from the Classroom by a human, because an automated removal triggered by a
 * mis-keyed status would delete that student's submitted work, and nothing
 * here is worth that risk.
 *
 * Sequential rather than parallel, and intentionally so. Classroom's quotas
 * are per-project and easy to exhaust; forty students at a time in order is
 * fast enough for a job that runs hourly, and it keeps the failure report
 * readable.
 */
export async function syncOffering(
  descriptor: CourseDescriptor,
  roster: { students: string[]; teachers: string[] },
): Promise<SyncOutcome> {
  const course = await ensureCourse(descriptor);

  const problems: { email: string; error: string }[] = [];
  let teachersAdded = 0;
  let studentsAdded = 0;

  // Teachers first: a student arriving in an empty, teacherless Classroom is
  // a confusing first impression, and it costs nothing to order it this way.
  for (const email of roster.teachers) {
    const outcome = await addToRoster(course.courseId, email, "teachers");
    if (outcome.added) teachersAdded += 1;
    if (outcome.error) problems.push({ email, error: outcome.error });
  }

  for (const email of roster.students) {
    const outcome = await addToRoster(course.courseId, email, "students");
    if (outcome.added) studentsAdded += 1;
    if (outcome.error) problems.push({ email, error: outcome.error });
  }

  return {
    courseId: course.courseId,
    link: course.link,
    courseCreated: course.created,
    studentsAdded,
    teachersAdded,
    problems,
  };
}
