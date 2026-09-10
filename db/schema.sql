-- ============================================================================
--  WIPEG — student records
--  PostgreSQL 13+
--
--  Scope: student data only. Fees and payments are deliberately NOT here yet;
--  they attach later without changing anything below.
--
--  TWO IDEAS THIS SCHEMA IS BUILT AROUND
--
--  1. A STUDENT IS A PERSON. WHAT THEY STUDY IS A SEPARATE, CHANGING THING.
--     `students` holds who someone is (changes almost never). `enrolments`
--     holds what they are studying this year (changes every year). One person
--     keeps one student row for life and gains an enrolment row each year.
--     That is what makes transcripts and "who ever studied X" answerable.
--
--  2. LEVEL 1 IS SHARED ACROSS A DEPARTMENT; STUDENTS SPLIT AT LEVEL 2.
--     So a class is keyed by the DEPARTMENT at Level 1 —
--         "Computer Engineering, Level 1, Garoua, 2026/27"
--     and by the SPECIALISATION from Level 2 upward —
--         "Software Engineering, Level 2, Garoua, 2027/28".
--     `classes.programme_id` is therefore null at Level 1 and required above
--     it, enforced by a CHECK so it cannot be got wrong by accident.
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

-- A department is what a student joins at Level 1 and stays in for the whole
-- programme: Computer Engineering, Medical & Biomedical Sciences, and so on.
CREATE TABLE departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,          -- matches the website: 'computer-engineering'
  code        text NOT NULL UNIQUE,          -- 'CEN', 'MED' — short, for labels
  name        text NOT NULL,                 -- 'Computer Engineering'
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- A programme is the specialisation a student chooses at Level 2 — Software
-- Engineering, Network and Security, Nursing, Midwifery. Nobody is enrolled
-- in one of these at Level 1.
CREATE TABLE programmes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id   uuid NOT NULL REFERENCES departments(id),
  code            text NOT NULL UNIQUE,      -- 'SWE', 'NUR'
  name            text NOT NULL,             -- 'Software Engineering'
  online_available boolean NOT NULL DEFAULT true,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Lets `classes` prove that a specialisation really belongs to the
  -- department the class is under — see the composite foreign key below.
  UNIQUE (id, department_id)
);

-- Levels run 1-5 continuously across awards, as confirmed by the registry.
-- Kept as a table rather than hard-coded so "Level 3 = Bachelor" lives in
-- exactly one place.
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
--  CLASSES
--
--  Level 1  →  campus x DEPARTMENT     x level x year   (programme_id IS NULL)
--  Level 2+ →  campus x SPECIALISATION x level x year   (programme_id set)
--
--  One class becomes one Google Classroom later. Online and on-campus
--  students share it.
-- ===========================================================================

CREATE TABLE classes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id         uuid NOT NULL REFERENCES campuses(id),

  -- Always set, at every level. A specialisation never leaves its department.
  department_id     uuid NOT NULL REFERENCES departments(id),

  -- Null at Level 1, where the whole department is taught together.
  -- Required from Level 2, where students have chosen a specialisation.
  programme_id      uuid,

  level             smallint NOT NULL REFERENCES levels(level),
  academic_year_id  uuid NOT NULL REFERENCES academic_years(id),

  -- Filled in when the Classroom is created. Null means "not created yet",
  -- which is a normal state, not an error.
  google_course_id  text UNIQUE,

  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- The Level 1 rule, enforced by the database rather than by good intentions.
  CONSTRAINT level_one_is_department_wide CHECK (
    (level = 1 AND programme_id IS NULL) OR
    (level > 1 AND programme_id IS NOT NULL)
  ),

  -- A Nursing class can never be filed under Computer Engineering: the
  -- programme must belong to the department named on the same row.
  FOREIGN KEY (programme_id, department_id)
    REFERENCES programmes (id, department_id)
);

CREATE TRIGGER classes_touch BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Two partial indexes rather than one UNIQUE, because PostgreSQL treats NULLs
-- as distinct — a plain unique constraint would happily allow the same Level 1
-- class to be created over and over.
CREATE UNIQUE INDEX classes_unique_level_one
  ON classes (campus_id, department_id, level, academic_year_id)
  WHERE programme_id IS NULL;

CREATE UNIQUE INDEX classes_unique_specialised
  ON classes (campus_id, programme_id, level, academic_year_id)
  WHERE programme_id IS NOT NULL;

CREATE INDEX classes_year ON classes (academic_year_id);


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

  -- Required for every student, as the registry asked. For an adult student
  -- this is their next of kin / emergency contact; for a minor it is the
  -- guardian. Age is calculated from date_of_birth — never stored, because a
  -- stored "is a minor" flag is correct the day you write it and wrong after.
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

CREATE INDEX students_phone   ON students (phone);
CREATE INDEX students_surname ON students (lower(surname));
CREATE INDEX students_status  ON students (status);


-- ===========================================================================
--  ENROLMENTS — what they are studying, this year
--  A student who does Level 1, Level 2 then a Bachelor has three of these.
--  Their Level 1 row points at a department class; the later ones point at
--  their chosen specialisation. The choice of specialisation is therefore
--  recorded simply by which class they enrolled in at Level 2.
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

-- A student can only be in one active class at a time. Relax this if WIPEG
-- ever lets someone follow two programmes at once.
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

  -- What they are applying for. At Level 1 they apply to a department; the
  -- specialisation is optional there and recorded only as a preference, which
  -- is useful for guessing how big each Level 2 class will need to be.
  campus_id           uuid NOT NULL REFERENCES campuses(id),
  department_id       uuid NOT NULL REFERENCES departments(id),
  programme_id        uuid,
  level_applied       smallint NOT NULL REFERENCES levels(level),
  academic_year_id    uuid NOT NULL REFERENCES academic_years(id),
  delivery_mode       text NOT NULL DEFAULT 'on_campus'
                        CHECK (delivery_mode IN ('on_campus', 'online')),

  -- Entering above Level 1 means joining a specialisation directly, so it has
  -- to be named.
  CONSTRAINT specialisation_required_above_level_one CHECK (
    level_applied = 1 OR programme_id IS NOT NULL
  ),

  FOREIGN KEY (programme_id, department_id)
    REFERENCES programmes (id, department_id),

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

  CHECK (status <> 'accepted' OR student_id IS NOT NULL)
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
--  VIEWS
--  So the everyday questions are one short query, not a join written from
--  memory each time.
-- ===========================================================================

-- Everyone currently studying, with where and what. `programme` reads
-- "Level 1 (shared)" for first-year students, who have not chosen yet.
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
  COALESCE(p.name, 'Level 1 (shared)') AS programme,
  cl.level,
  l.award,
  ay.label            AS academic_year,
  e.delivery_mode
FROM enrolments e
JOIN students        s  ON s.id  = e.student_id
JOIN classes         cl ON cl.id = e.class_id
JOIN campuses        c  ON c.id  = cl.campus_id
JOIN departments     d  ON d.id  = cl.department_id
LEFT JOIN programmes p  ON p.id  = cl.programme_id      -- null at Level 1
JOIN levels          l  ON l.level = cl.level
JOIN academic_years  ay ON ay.id = cl.academic_year_id
WHERE e.status = 'active';

-- The list you will want every exam period: who has to travel in.
CREATE VIEW online_students_for_exams AS
SELECT * FROM current_students WHERE delivery_mode = 'online';

-- Level 1 students and the specialisation they said they wanted, so you can
-- size next year's Level 2 classes before you have to create them.
CREATE VIEW level_one_specialisation_interest AS
SELECT
  c.name              AS campus,
  d.name              AS department,
  COALESCE(p.name, 'Undecided') AS intended_programme,
  count(*)            AS applicants
FROM applications a
JOIN campuses        c ON c.id = a.campus_id
JOIN departments     d ON d.id = a.department_id
LEFT JOIN programmes p ON p.id = a.programme_id
WHERE a.level_applied = 1
  AND a.status IN ('submitted', 'reviewing', 'accepted')
GROUP BY c.name, d.name, COALESCE(p.name, 'Undecided');

COMMIT;
