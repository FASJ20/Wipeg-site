-- ============================================================================
--  Migration 002 — results and attendance
--
--  Run AFTER 001_account_requests.sql, in the Supabase SQL Editor.
--
--  This is the part Google Classroom cannot do. Classroom grades an
--  assignment; it cannot produce the result slip a student takes to an
--  employer, and it loses everything when a class is archived.
--
--  Safe to run twice.
-- ============================================================================

BEGIN;

-- ###########################################################################
--  LAYER 5b — ASSESSMENT
--
--  What Google Classroom cannot do. Classroom grades an assignment; it does
--  not produce the result slip a student takes to an employer, and it loses
--  the lot when a class is archived. Official marks, attendance and the
--  transcript live here.
--
--  Two rules carried over from the rest of the schema:
--    * marks are entered, totals are calculated. No stored total and no
--      stored grade letter — both come from the `student_results` view, so
--      changing the pass mark does not mean rewriting history.
--    * nothing reaches a student until the registry publishes it.
-- ###########################################################################

-- The A/B/C boundaries, as data rather than buried in code. WIPEG changes
-- these by editing rows, not by asking a developer.
CREATE TABLE IF NOT EXISTS grading_scale (
  grade         text PRIMARY KEY,
  min_mark      numeric(5,2) NOT NULL CHECK (min_mark >= 0 AND min_mark <= 100),
  grade_point   numeric(3,2) NOT NULL CHECK (grade_point >= 0 AND grade_point <= 5),
  is_pass       boolean NOT NULL,
  description   text,
  UNIQUE (min_mark)
);

-- One row per student per subject per attempt: the official result.
--
-- `attempt` carries resits. The first sitting is 1; a resit is 2 and does
-- not overwrite the first, because "failed in June, passed in September" is
-- the true record and a transcript has to be able to show it.
CREATE TABLE IF NOT EXISTS results (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrolment_id       uuid NOT NULL REFERENCES enrolments(id) ON DELETE RESTRICT,
  course_offering_id uuid NOT NULL REFERENCES course_offerings(id) ON DELETE RESTRICT,

  attempt            smallint NOT NULL DEFAULT 1 CHECK (attempt BETWEEN 1 AND 5),

  -- Both out of 100. Null means not marked yet, which is not the same as 0.
  ca_mark            numeric(5,2) CHECK (ca_mark   >= 0 AND ca_mark   <= 100),
  exam_mark          numeric(5,2) CHECK (exam_mark >= 0 AND exam_mark <= 100),

  -- draft      the lecturer is still typing
  -- submitted  the lecturer has finished; the registry has not released it
  -- published  the student can see it
  status             text NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'submitted', 'published')),

  entered_by         uuid REFERENCES staff(person_id) ON DELETE RESTRICT,
  entered_at         timestamptz,
  published_by       uuid REFERENCES staff(person_id) ON DELETE RESTRICT,
  published_at       timestamptz,

  remark             text,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  UNIQUE (enrolment_id, course_offering_id, attempt),

  -- A published result must have a mark and must name who released it.
  -- This is what stops a blank row appearing on a transcript.
  CONSTRAINT published_results_are_complete CHECK (
    status <> 'published' OR
    (exam_mark IS NOT NULL AND published_by IS NOT NULL AND published_at IS NOT NULL)
  )
);

DROP TRIGGER IF EXISTS results_touch ON results;
CREATE TRIGGER results_touch BEFORE UPDATE ON results
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX IF NOT EXISTS results_enrolment ON results (enrolment_id);
CREATE INDEX IF NOT EXISTS results_offering  ON results (course_offering_id, status);

-- One meeting of one subject. Attendance hangs off a session rather than a
-- date, because a subject can meet twice in a day and those are two
-- different registers.
CREATE TABLE IF NOT EXISTS class_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,

  held_on            date NOT NULL,
  starts_at          time,
  ends_at            time,
  topic              text,

  taken_by           uuid REFERENCES staff(person_id) ON DELETE RESTRICT,
  created_at         timestamptz NOT NULL DEFAULT now(),

  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  UNIQUE (course_offering_id, held_on, starts_at)
);

CREATE INDEX IF NOT EXISTS class_sessions_offering ON class_sessions (course_offering_id, held_on DESC);

-- Who was there. One row per student per session.
CREATE TABLE IF NOT EXISTS attendance (
  session_id  uuid NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES students(person_id) ON DELETE RESTRICT,

  status      text NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  note        text,
  marked_by   uuid REFERENCES staff(person_id) ON DELETE RESTRICT,
  marked_at   timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS attendance_student ON attendance (student_id);



-- WIPEG's grading scale. Change these rows to change the scale: every past
-- result re-reads against the new boundaries, because no grade is stored.
INSERT INTO grading_scale (grade, min_mark, grade_point, is_pass, description) VALUES
  ('A',  80.00, 4.00, true,  'Excellent'),
  ('B+', 70.00, 3.50, true,  'Very good'),
  ('B',  65.00, 3.00, true,  'Good'),
  ('C+', 60.00, 2.50, true,  'Fairly good'),
  ('C',  55.00, 2.00, true,  'Average'),
  ('D+', 50.00, 1.50, true,  'Pass'),
  ('D',  45.00, 1.00, true,  'Weak pass'),
  ('F',   0.00, 0.00, false, 'Fail')
ON CONFLICT (grade) DO NOTHING;

-- A student's published results, with the total and grade worked out on
-- read. Nothing here is stored, so changing the weighting or the pass mark
-- makes every past result re-read correctly.
CREATE OR REPLACE VIEW student_results AS
SELECT
  r.id                AS result_id,
  e.student_id,
  s.matricule,
  ay.label            AS academic_year,
  t.name              AS term,
  c.code              AS course_code,
  c.title             AS course_title,
  c.credit_hours,
  r.attempt,
  r.ca_mark,
  r.exam_mark,
  total.mark          AS total_mark,
  g.grade,
  g.grade_point,
  g.is_pass,
  r.remark,
  r.published_at
FROM results r
JOIN enrolments        e  ON e.id  = r.enrolment_id
JOIN students          s  ON s.person_id = e.student_id
JOIN course_offerings  co ON co.id = r.course_offering_id
JOIN courses           c  ON c.id  = co.course_id
JOIN terms             t  ON t.id  = co.term_id
JOIN academic_years    ay ON ay.id = co.academic_year_id
CROSS JOIN LATERAL (
  -- Continuous assessment 30%, examination 70% — the usual Cameroonian
  -- split. A missing CA mark counts as nothing rather than voiding the
  -- result, so a student who skipped the test still gets the exam mark
  -- they earned.
  SELECT round(COALESCE(r.ca_mark, 0) * 0.30 + COALESCE(r.exam_mark, 0) * 0.70, 2) AS mark
) total
LEFT JOIN LATERAL (
  SELECT gs.* FROM grading_scale gs
   WHERE gs.min_mark <= total.mark
   ORDER BY gs.min_mark DESC
   LIMIT 1
) g ON true
WHERE r.status = 'published';

-- How often a student actually turned up, per subject. The percentage is
-- what a minimum-attendance rule gets checked against.
CREATE OR REPLACE VIEW attendance_summary AS
SELECT
  a.student_id,
  co.id               AS course_offering_id,
  c.code              AS course_code,
  c.title             AS course_title,
  count(*)                                               AS sessions_held,
  count(*) FILTER (WHERE a.status IN ('present', 'late')) AS sessions_attended,
  round(
    100.0 * count(*) FILTER (WHERE a.status IN ('present', 'late'))
          / NULLIF(count(*), 0)
  , 1)                                                   AS percent_attended
FROM attendance a
JOIN class_sessions   cs ON cs.id = a.session_id
JOIN course_offerings co ON co.id = cs.course_offering_id
JOIN courses          c  ON c.id  = co.course_id
GROUP BY a.student_id, co.id, c.code, c.title;


ALTER TABLE grading_scale  ENABLE ROW LEVEL SECURITY;
ALTER TABLE results        ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance     ENABLE ROW LEVEL SECURITY;

COMMIT;


-- ----------------------------------------------------------------- check it
-- Expect 29 tables and 8 grades.
--
--   SELECT
--     (SELECT count(*) FROM information_schema.tables
--       WHERE table_schema='public' AND table_type='BASE TABLE') AS tables,
--     (SELECT count(*) FROM grading_scale)                       AS grades;
