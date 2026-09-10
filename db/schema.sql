-- ============================================================================
--  WIPEG — student records
--  PostgreSQL 13+
--
--  Scope: student data only. Fees and payments are deliberately NOT here yet;
--  they attach later without changing anything below.
--
--  The one idea this schema is built around:
--
--      A STUDENT IS A PERSON.  WHAT THEY STUDY IS A SEPARATE, CHANGING THING.
--
--  So `students` holds who someone is (changes almost never) and `enrolments`
--  holds what they are studying this year (changes every year). One person has
--  one student row for life and a new enrolment row each year. That is what
--  makes history, transcripts and "who ever studied X" possible.
--
--  Run with:  psql "$DATABASE_URL" -f db/schema.sql
-- ============================================================================

BEGIN;

-- Every table's id is a random UUID rather than 1, 2, 3 — so that a student
-- record reachable by URL cannot be found by guessing the next number.
-- gen_random_uuid() is built into PostgreSQL 13 and later, so there is no
-- extension to install and no permission to request from the host.


-- ---------------------------------------------------------------------------
--  Keeps updated_at honest without anyone remembering to set it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ===========================================================================
--  REFERENCE LISTS
--  Small, rarely change. Seeded to match src/data/site.ts so the website and
--  the database never disagree about what WIPEG offers.
-- ===========================================================================

CREATE TABLE campuses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,          -- 'GRA', 'BDA', 'YDE', 'MRA', 'TBO'
  name        text NOT NULL,                 -- 'Garoua'
  region      text NOT NULL,                 -- 'North Region'
  is_main     boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,          -- matches the website: 'computer-engineering'
  name        text NOT NULL,                 -- 'Computer Engineering'
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- A programme is the specialisation a student actually enrols in — Software
-- Engineering, Nursing, Midwifery — not the department above it. This is the
-- level your rule works at: a Level 1 Software Engineering student has no
-- business in a Level 1 Nursing class.
CREATE TABLE programmes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id   uuid NOT NULL REFERENCES departments(id),
  code            text NOT NULL UNIQUE,      -- 'SWE', 'NUR' — used in the matricule if wanted
  name            text NOT NULL,             -- 'Software Engineering'
  online_available boolean NOT NULL DEFAULT true,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Levels run 1-5 continuously across awards, as you confirmed. Kept as a table
-- rather than hard-coded so "Level 3 = Bachelor" lives in exactly one place.
CREATE TABLE levels (
  level       smallint PRIMARY KEY CHECK (level BETWEEN 1 AND 5),
  award       text NOT NULL,                 -- 'HND / BTS', 'Bachelor', 'Master'
  award_fr    text NOT NULL
);

INSERT INTO levels (level, award, award_fr) VALUES
  (1, 'HND / BTS', 'HND / BTS'),
  (2, 'HND / BTS', 'HND / BTS'),
  (3, 'Bachelor',  'Licence'),
  (4, 'Master',    'Master'),
  (5, 'Master',    'Master');

CREATE TABLE academic_years (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL UNIQUE,          -- '2026/27'
  starts_on   date NOT NULL,
  ends_on     date NOT NULL,
  is_current  boolean NOT NULL DEFAULT false,
  CHECK (ends_on > starts_on)
);

-- Only ever one current year.
CREATE UNIQUE INDEX one_current_academic_year
  ON academic_years ((is_current)) WHERE is_current;


-- ===========================================================================
--  CLASSES — the four-part key
--  campus x programme x level x academic year. One class = one Google
--  Classroom, later on. Online and on-campus students share it.
-- ===========================================================================

CREATE TABLE classes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id         uuid NOT NULL REFERENCES campuses(id),
  programme_id      uuid NOT NULL REFERENCES programmes(id),
  level             smallint NOT NULL REFERENCES levels(level),
  academic_year_id  uuid NOT NULL REFERENCES academic_years(id),

  -- Filled in when the Classroom is created. Null means "not created yet",
  -- which is a normal state, not an error.
  google_course_id  text UNIQUE,

  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- The same class cannot be created twice.
  UNIQUE (campus_id, programme_id, level, academic_year_id)
);

CREATE TRIGGER classes_touch BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ===========================================================================
--  STUDENTS — who the person is
--  One row per human, for life. Nothing here says what they are studying.
-- ===========================================================================

CREATE TABLE students (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- WIPEG's own student number. Issued by the administration on paper, so we
  -- store it and never generate it. Null until it has been issued.
  -- TODO: add a CHECK for the real format once the administrator sends it.
  matricule         text UNIQUE,

  -- Names. `name_on_id` exists because a diploma must match the student's
  -- birth certificate or national ID exactly — and Cameroonian names do not
  -- always split cleanly into surname and given names.
  surname           text NOT NULL,
  given_names       text NOT NULL,
  name_on_id        text NOT NULL,

  sex               text CHECK (sex IN ('female', 'male', 'other')),
  date_of_birth     date NOT NULL,
  place_of_birth    text,
  nationality       text NOT NULL DEFAULT 'Cameroonian',

  -- Phone is the real identifier here — most applicants have no email before
  -- they enrol. Stored in one normalised shape so the same person cannot be
  -- entered twice as "677 487 127" and "+237677487127".
  phone             text NOT NULL CHECK (phone ~ '^\+[0-9]{8,15}$'),
  phone_alt         text CHECK (phone_alt ~ '^\+[0-9]{8,15}$'),

  personal_email    text,                    -- their own, optional
  school_email      text UNIQUE,             -- @wipeg — created on enrolment

  preferred_language text NOT NULL DEFAULT 'en'
                      CHECK (preferred_language IN ('en', 'fr')),

  address_town      text,
  address_detail    text,

  -- Required for every student, as you asked. For an adult student this is
  -- their next of kin / emergency contact; for a minor it is the guardian.
  -- Age is calculated from date_of_birth — never stored, because a stored
  -- "is a minor" flag is correct the day you write it and wrong after.
  guardian_name     text NOT NULL,
  guardian_phone    text NOT NULL CHECK (guardian_phone ~ '^\+[0-9]{8,15}$'),
  guardian_relation text,                    -- 'Mother', 'Uncle', 'Spouse'

  photo_key         text,                    -- points at the file in storage

  -- Students are never deleted. A 2027 leaver still needs a transcript in 2032.
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'graduated', 'withdrawn', 'deceased')),

  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CHECK (date_of_birth < CURRENT_DATE)
);

CREATE TRIGGER students_touch BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Emails are matched case-insensitively; nobody should be able to register
-- Marie@… and marie@… as two people.
CREATE UNIQUE INDEX students_personal_email_lower
  ON students (lower(personal_email)) WHERE personal_email IS NOT NULL;

CREATE INDEX students_phone       ON students (phone);
CREATE INDEX students_surname     ON students (lower(surname));
CREATE INDEX students_status      ON students (status);


-- ===========================================================================
--  ENROLMENTS — what they are studying, this year
--  A student who does Level 1, Level 2 then a Bachelor has three of these.
-- ===========================================================================

CREATE TABLE enrolments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES students(id),
  class_id      uuid NOT NULL REFERENCES classes(id),

  -- Recorded per student, not per class: online and on-campus students sit in
  -- the same class, but you need this list every exam period, because these
  -- are the people who must travel in for exams and defence.
  delivery_mode text NOT NULL DEFAULT 'on_campus'
                  CHECK (delivery_mode IN ('on_campus', 'online')),

  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed', 'repeating',
                                    'withdrawn', 'transferred')),

  started_on    date NOT NULL DEFAULT CURRENT_DATE,
  ended_on      date,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (student_id, class_id),
  CHECK (ended_on IS NULL OR ended_on >= started_on)
);

CREATE TRIGGER enrolments_touch BEFORE UPDATE ON enrolments
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX enrolments_class   ON enrolments (class_id);
CREATE INDEX enrolments_student ON enrolments (student_id);

-- A student can only be in one active class at a time.
CREATE UNIQUE INDEX enrolments_one_active_per_student
  ON enrolments (student_id) WHERE status = 'active';


-- ===========================================================================
--  APPLICATIONS — someone who applied, who may never become a student
--  Kept separate from `students` so that people who never turned up don't
--  clutter the student roll, and so a person who applies twice (rejected one
--  year, accepted the next) keeps both records.
-- ===========================================================================

CREATE TABLE applications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Null until the application is accepted and a student record is created.
  student_id          uuid REFERENCES students(id),

  -- What they are applying for
  campus_id           uuid NOT NULL REFERENCES campuses(id),
  programme_id        uuid NOT NULL REFERENCES programmes(id),
  level_applied       smallint NOT NULL REFERENCES levels(level),
  academic_year_id    uuid NOT NULL REFERENCES academic_years(id),
  delivery_mode       text NOT NULL DEFAULT 'on_campus'
                        CHECK (delivery_mode IN ('on_campus', 'online')),

  -- What they typed at the time, kept exactly as submitted even if the
  -- student record is later corrected. This is the record of what was claimed.
  surname             text NOT NULL,
  given_names         text NOT NULL,
  phone               text NOT NULL CHECK (phone ~ '^\+[0-9]{8,15}$'),
  email               text,
  prior_qualification text,                  -- 'GCE A/L', 'HND', 'Baccalauréat'

  source              text,                  -- how they heard about WIPEG

  status              text NOT NULL DEFAULT 'submitted'
                        CHECK (status IN ('submitted', 'reviewing', 'accepted',
                                          'rejected', 'withdrawn')),
  decided_at          timestamptz,
  decided_by          text,
  notes               text,

  submitted_at        timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CHECK (status NOT IN ('accepted') OR student_id IS NOT NULL)
);

CREATE TRIGGER applications_touch BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX applications_status ON applications (status);
CREATE INDEX applications_phone  ON applications (phone);
CREATE INDEX applications_year   ON applications (academic_year_id);


-- ===========================================================================
--  DOCUMENTS — certificates and photos
--  The file itself lives in storage (Drive, S3, whatever). Only the reference
--  is here: a database full of scanned PDFs gets slow, costly and horrible to
--  back up.
-- ===========================================================================

CREATE TABLE documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES students(id),

  kind          text NOT NULL CHECK (kind IN (
                  'birth_certificate',
                  'gce_ol',
                  'gce_al',
                  'hnd_bts',          -- for students entering at Level 3
                  'bachelor_degree',  -- for students entering at Level 4
                  'photo',
                  'national_id',
                  'other'
                )),

  file_key      text NOT NULL,               -- where it is in storage
  original_name text,
  content_type  text,
  byte_size     integer CHECK (byte_size > 0),

  verified_at   timestamptz,
  verified_by   text,

  uploaded_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX documents_student ON documents (student_id);
CREATE INDEX documents_kind    ON documents (student_id, kind);


-- ===========================================================================
--  A COUPLE OF VIEWS
--  So the everyday questions are one short query, not a join written from
--  memory each time.
-- ===========================================================================

-- Everyone currently studying, with where and what.
CREATE VIEW current_students AS
SELECT
  s.id                AS student_id,
  s.matricule,
  s.surname,
  s.given_names,
  s.phone,
  s.school_email,
  date_part('year', age(s.date_of_birth))::int AS age,
  c.name              AS campus,
  d.name              AS department,
  p.name              AS programme,
  cl.level,
  l.award,
  ay.label            AS academic_year,
  e.delivery_mode
FROM enrolments e
JOIN students        s  ON s.id  = e.student_id
JOIN classes         cl ON cl.id = e.class_id
JOIN campuses        c  ON c.id  = cl.campus_id
JOIN programmes      p  ON p.id  = cl.programme_id
JOIN departments     d  ON d.id  = p.department_id
JOIN levels          l  ON l.level = cl.level
JOIN academic_years  ay ON ay.id = cl.academic_year_id
WHERE e.status = 'active';

-- The list you will want every exam period: who has to travel in.
CREATE VIEW online_students_for_exams AS
SELECT * FROM current_students WHERE delivery_mode = 'online';

COMMIT;
