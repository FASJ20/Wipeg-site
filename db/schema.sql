-- ============================================================================
--  WIPEG — academic records
--  PostgreSQL 13+   |   currency: XAF   |   all timestamps timestamptz (UTC)
--
--  Run:       psql "$DATABASE_URL" -f db/schema.sql
--  Undo:      psql "$DATABASE_URL" -f db/rollback.sql
--  The reasoning behind every table below: db/DESIGN.md
--
--  ---------------------------------------------------------------------------
--  FIVE LAYERS. Read the file top to bottom and it explains itself.
--
--    1. CATALOGUE   what WIPEG offers      — edited once a year, by hand
--    2. CALENDAR    when it is offered     — edited once a year, by hand
--    3. PEOPLE      who is involved        — one row per human, for life
--    4. DELIVERY    who is taught what     — changes constantly
--    5. MONEY       what is owed and paid  — append-only, never edited
--
--  A table may only depend on the layers above it. Nothing in the catalogue
--  knows a student exists. That is what makes it safe to edit in August.
--
--  ---------------------------------------------------------------------------
--  THREE RULES THE WHOLE DESIGN TURNS ON
--
--  1. A PERSON IS NOT A ROLE.
--     `persons` holds a human being. `students` and `staff` say what that
--     human is to WIPEG. A graduate hired as a lab assistant gains a staff
--     row; they do not become a second person with a second phone number.
--
--  2. LEVEL 1 IS DEPARTMENT-WIDE; STUDENTS SPLIT AT LEVEL 2.
--     Wherever a specialisation could be named — classes, curriculum, fees —
--     the column is null at Level 1 and required above it, enforced by CHECK.
--
--  3. A STATUS THAT CAN BE CALCULATED IS NEVER STORED.
--     There is no fee status column anywhere. Whether a student has paid is
--     charges minus payments, computed on read by the `fee_status` view. A
--     stored status is correct the day you write it and wrong the next.
-- ============================================================================

BEGIN;

-- Random UUID keys rather than 1, 2, 3: a record reachable by URL must not be
-- findable by guessing the next number. gen_random_uuid() is built into
-- PostgreSQL 13+, so there is no extension to install on a managed host.

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ###########################################################################
--  LAYER 1 — CATALOGUE
-- ###########################################################################

CREATE TABLE campuses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,          -- 'GRA', 'YDE', 'MRA', 'BDA', 'TBO'
  name        text NOT NULL,                 -- 'Garoua'
  region      text NOT NULL,                 -- 'North Region'
  phone       text CHECK (phone ~ '^\+[0-9]{8,15}$'),
  is_main     boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Exactly one main campus. Garoua today; this stops a second one appearing.
CREATE UNIQUE INDEX campuses_one_main ON campuses ((is_main)) WHERE is_main;

-- What a student joins at Level 1 and stays in for the whole programme.
CREATE TABLE departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,          -- matches src/data/site.ts
  code        text NOT NULL UNIQUE,          -- 'CEN', 'MED'
  name        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- The qualification being worked towards — what you called Programs
-- (HND / Degree / Masters). It is NOT what a student studies (that is a
-- specialisation); it is the certificate they walk away with.
CREATE TABLE awards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,          -- 'HND', 'BACHELOR', 'MASTER'
  name        text NOT NULL,                 -- 'HND / BTS'
  name_fr     text NOT NULL,
  rank        smallint NOT NULL UNIQUE,      -- 1 = lowest, for ordering
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Levels run 1-5 continuously across awards, as the registry confirmed, so the
-- award is a property of the level and is stored in exactly one place.
CREATE TABLE levels (
  level       smallint PRIMARY KEY CHECK (level BETWEEN 1 AND 5),
  award_id    uuid NOT NULL REFERENCES awards(id) ON DELETE RESTRICT,
  name        text NOT NULL                  -- 'Level 1'
);

CREATE INDEX levels_award ON levels (award_id);

-- What a student actually studies from Level 2: Software Engineering,
-- Nursing, Midwifery. The website lists these as a department's "courses" —
-- that word means something different here (see `courses` below).
CREATE TABLE specialisations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id     uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  code              text NOT NULL UNIQUE,    -- 'SWE', 'NUR'
  name              text NOT NULL,
  online_available  boolean NOT NULL DEFAULT true,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- Lets every table that names a specialisation prove it belongs to the
  -- department on the same row. Used by the composite keys further down.
  UNIQUE (id, department_id)
);

CREATE INDEX specialisations_department ON specialisations (department_id);

-- A taught subject: "Database Systems", "Anatomy and Physiology". Catalogue
-- only — it says nothing about who studies it or when. A course belongs to no
-- department, because general subjects (English, Entrepreneurship) are taught
-- across all of them. Placement is `curriculum_entries`.
CREATE TABLE courses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,        -- 'CEN201'
  title         text NOT NULL,
  credit_hours  smallint CHECK (credit_hours BETWEEN 1 AND 30),
  description   text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Which subjects a given group studies, and when. One row reads: "Level 2
-- Software Engineering students take CEN201 in term 1".
--
-- specialisation_id null means "everyone in this department at this level",
-- which covers both Level 1 (nobody has specialised yet) and shared subjects
-- at higher levels (Entrepreneurship for every Level 2 student).
CREATE TABLE curriculum_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id     uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  specialisation_id uuid,
  level             smallint NOT NULL REFERENCES levels(level) ON DELETE RESTRICT,
  term_no           smallint CHECK (term_no BETWEEN 1 AND 3),
  course_id         uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  is_core           boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- Rule 2: nobody has specialised at Level 1, so nothing may be aimed at a
  -- specialisation there.
  CONSTRAINT curriculum_level_one_is_department_wide
    CHECK (level > 1 OR specialisation_id IS NULL),

  FOREIGN KEY (specialisation_id, department_id)
    REFERENCES specialisations (id, department_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX curriculum_unique_shared
  ON curriculum_entries (department_id, level, course_id)
  WHERE specialisation_id IS NULL;

CREATE UNIQUE INDEX curriculum_unique_specialised
  ON curriculum_entries (specialisation_id, level, course_id)
  WHERE specialisation_id IS NOT NULL;

CREATE INDEX curriculum_course     ON curriculum_entries (course_id);
CREATE INDEX curriculum_department ON curriculum_entries (department_id, level);


-- ###########################################################################
--  LAYER 2 — CALENDAR
-- ###########################################################################

CREATE TABLE academic_years (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL UNIQUE,          -- '2026/27'
  starts_on   date NOT NULL,
  ends_on     date NOT NULL,
  is_current  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CHECK (ends_on > starts_on),

  -- Lets classes and terms prove they belong to the same year. See the
  -- composite key on `course_offerings`.
  UNIQUE (id, label)
);

CREATE UNIQUE INDEX one_current_academic_year
  ON academic_years ((is_current)) WHERE is_current;

-- Semesters. Timetables, course offerings and (later) results all hang off a
-- term rather than a whole year.
CREATE TABLE terms (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id  uuid NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  term_no           smallint NOT NULL CHECK (term_no BETWEEN 1 AND 3),
  name              text NOT NULL,           -- 'First semester'
  starts_on         date NOT NULL,
  ends_on           date NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CHECK (ends_on > starts_on),
  UNIQUE (academic_year_id, term_no),
  UNIQUE (id, academic_year_id)
);

CREATE INDEX terms_year ON terms (academic_year_id);


-- ###########################################################################
--  LAYER 3 — PEOPLE
-- ###########################################################################

-- A human being. Not a student, not a lecturer — a person. Everything that is
-- true of someone whatever their relationship to WIPEG lives here, once.
CREATE TABLE persons (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- `name_on_id` exists because a diploma must match the birth certificate or
  -- national ID exactly, and Cameroonian names do not always split cleanly
  -- into surname and given names.
  surname           text NOT NULL,
  given_names       text NOT NULL,
  name_on_id        text NOT NULL,

  sex               text CHECK (sex IN ('female', 'male', 'other')),
  date_of_birth     date CHECK (date_of_birth IS NULL OR date_of_birth < CURRENT_DATE),
  place_of_birth    text,
  nationality       text NOT NULL DEFAULT 'Cameroonian',

  -- Phone is the real identifier here — most applicants have no email before
  -- they enrol. Stored in one normalised shape so the same person cannot be
  -- entered twice as "677 487 127" and "+237677487127". Deliberately NOT
  -- unique: two siblings legitimately share a parent's handset.
  phone             text NOT NULL CHECK (phone ~ '^\+[0-9]{8,15}$'),
  phone_alt         text CHECK (phone_alt ~ '^\+[0-9]{8,15}$'),

  personal_email    text,
  school_email      text UNIQUE,             -- the Workspace account, once created

  preferred_language text NOT NULL DEFAULT 'en'
                      CHECK (preferred_language IN ('en', 'fr')),

  address_town      text,
  address_detail    text,
  photo_key         text,                    -- points at the file in storage

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER persons_touch BEFORE UPDATE ON persons
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Emails match case-insensitively; nobody should register Marie@ and marie@
-- as two people.
CREATE UNIQUE INDEX persons_personal_email_lower
  ON persons (lower(personal_email)) WHERE personal_email IS NOT NULL;

CREATE INDEX persons_phone   ON persons (phone);
CREATE INDEX persons_surname ON persons (lower(surname));

-- One human, seen as a student. The primary key IS the person key: a 1-to-1
-- extension needs no identity of its own.
CREATE TABLE students (
  person_id         uuid PRIMARY KEY REFERENCES persons(id) ON DELETE CASCADE,

  -- WIPEG's own student number, issued by the administration on paper, so it
  -- is stored and never generated here. Null until issued.
  -- TODO: add a CHECK for the real format once the administrator sends it.
  matricule         text UNIQUE,

  -- Required for every student, as the registry asked. For an adult this is
  -- next of kin; for a minor, the guardian. Kept on this row rather than in a
  -- guardians table so that NOT NULL can guarantee it exists — see DESIGN.md.
  guardian_name     text NOT NULL,
  guardian_phone    text NOT NULL CHECK (guardian_phone ~ '^\+[0-9]{8,15}$'),
  guardian_relation text,                    -- 'Mother', 'Uncle', 'Spouse'

  -- Students are never deleted. A 2027 leaver still needs a transcript in 2032.
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'graduated', 'withdrawn', 'deceased')),

  first_enrolled_on date,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER students_touch BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX students_status ON students (status);

-- The same human, seen as a lecturer or an administrator.
CREATE TABLE staff (
  person_id         uuid PRIMARY KEY REFERENCES persons(id) ON DELETE CASCADE,
  staff_number      text UNIQUE,
  employment_type   text NOT NULL DEFAULT 'part_time'
                      CHECK (employment_type IN ('permanent', 'part_time', 'visiting')),
  job_title         text,                    -- 'Lecturer', 'Head of Department'
  highest_qualification text,                -- 'PhD', 'Master', 'HND'
  hired_on          date,
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'on_leave', 'former')),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER staff_touch BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX staff_status ON staff (status);

-- A lecturer commonly teaches in more than one department, so this is a
-- many-to-many join rather than a column on `staff`.
CREATE TABLE staff_departments (
  staff_id      uuid NOT NULL REFERENCES staff(person_id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  is_head       boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, department_id)
);

CREATE INDEX staff_departments_department ON staff_departments (department_id);

-- At most one head per department.
CREATE UNIQUE INDEX staff_departments_one_head
  ON staff_departments (department_id) WHERE is_head;

-- Certificates, photos and IDs, for students and staff alike — a lecturer's
-- degree certificate is filed exactly like a student's birth certificate.
-- The file itself lives in storage; only the reference is here, because a
-- database full of scanned PDFs gets slow, costly and horrible to back up.
CREATE TABLE documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id     uuid NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,

  kind          text NOT NULL CHECK (kind IN (
                  'birth_certificate',
                  'gce_ol',
                  'gce_al',
                  'hnd_bts',          -- entering at Level 3
                  'bachelor_degree',  -- entering at Level 4
                  'master_degree',
                  'photo',
                  'national_id',
                  'cv',
                  'teaching_certificate',
                  'other'
                )),

  file_key      text NOT NULL UNIQUE,        -- where it is in storage
  original_name text,
  content_type  text,
  byte_size     integer CHECK (byte_size > 0),

  verified_at   timestamptz,
  verified_by   text,
  uploaded_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX documents_person ON documents (person_id);
CREATE INDEX documents_kind   ON documents (person_id, kind);


-- ###########################################################################
--  LAYER 4 — DELIVERY
-- ###########################################################################

-- A cohort: the group that moves through a year together.
--
--   Level 1  →  campus x DEPARTMENT     x level x year  (specialisation null)
--   Level 2+ →  campus x SPECIALISATION x level x year  (specialisation set)
--
-- Online and on-campus students share one class; how they attend is recorded
-- per student on `enrolments`, not here.
CREATE TABLE classes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id         uuid NOT NULL REFERENCES campuses(id) ON DELETE RESTRICT,

  -- Always set, at every level. A specialisation never leaves its department.
  department_id     uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,

  -- Null at Level 1, where the whole department is taught together.
  specialisation_id uuid,

  level             smallint NOT NULL REFERENCES levels(level) ON DELETE RESTRICT,
  academic_year_id  uuid NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,

  -- The cohort's Google Group, used for announcements and timetables. Subject
  -- Classrooms hang off `course_offerings`, one level down. Null means "not
  -- created yet", which is a normal state, not an error.
  google_group_email text UNIQUE,

  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- Rule 2, enforced by the database rather than by good intentions.
  CONSTRAINT level_one_is_department_wide CHECK (
    (level = 1 AND specialisation_id IS NULL) OR
    (level > 1 AND specialisation_id IS NOT NULL)
  ),

  -- A Nursing class can never be filed under Computer Engineering.
  FOREIGN KEY (specialisation_id, department_id)
    REFERENCES specialisations (id, department_id) ON DELETE RESTRICT,

  -- Lets course_offerings prove the class and the term share a year.
  UNIQUE (id, academic_year_id)
);

CREATE TRIGGER classes_touch BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Two partial indexes rather than one UNIQUE, because PostgreSQL treats NULLs
-- as distinct — a plain unique constraint would happily allow the same Level 1
-- class to be created over and over.
CREATE UNIQUE INDEX classes_unique_level_one
  ON classes (campus_id, department_id, level, academic_year_id)
  WHERE specialisation_id IS NULL;

CREATE UNIQUE INDEX classes_unique_specialised
  ON classes (campus_id, specialisation_id, level, academic_year_id)
  WHERE specialisation_id IS NOT NULL;

CREATE INDEX classes_year           ON classes (academic_year_id);
CREATE INDEX classes_campus         ON classes (campus_id);
CREATE INDEX classes_department     ON classes (department_id);
CREATE INDEX classes_specialisation ON classes (specialisation_id);

-- One subject, taught to one class, in one term. This is the row a Google
-- Classroom maps onto: it has exactly one roster and one set of teachers.
CREATE TABLE course_offerings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id          uuid NOT NULL,
  course_id         uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  term_id           uuid NOT NULL,

  -- Carried here only so the two composite keys below can prove that the
  -- class and the term belong to the same academic year. Never edited by hand.
  academic_year_id  uuid NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,

  google_course_id  text UNIQUE,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  FOREIGN KEY (class_id, academic_year_id)
    REFERENCES classes (id, academic_year_id) ON DELETE RESTRICT,
  FOREIGN KEY (term_id, academic_year_id)
    REFERENCES terms (id, academic_year_id) ON DELETE RESTRICT,

  UNIQUE (class_id, course_id, term_id)
);

CREATE TRIGGER course_offerings_touch BEFORE UPDATE ON course_offerings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX course_offerings_course ON course_offerings (course_id);
CREATE INDEX course_offerings_term   ON course_offerings (term_id);
CREATE INDEX course_offerings_class  ON course_offerings (class_id);

-- Who teaches it. Many-to-many, because co-teaching and lab assistants are
-- normal and a `lecturer_id` column on the offering could not express them.
CREATE TABLE teaching_assignments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  staff_id          uuid NOT NULL REFERENCES staff(person_id) ON DELETE RESTRICT,
  role              text NOT NULL DEFAULT 'lead'
                      CHECK (role IN ('lead', 'assistant')),
  assigned_on       date NOT NULL DEFAULT CURRENT_DATE,
  created_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (course_offering_id, staff_id)
);

CREATE INDEX teaching_assignments_staff ON teaching_assignments (staff_id);

-- Exactly one lead lecturer per offering; assistants are unlimited.
CREATE UNIQUE INDEX teaching_assignments_one_lead
  ON teaching_assignments (course_offering_id) WHERE role = 'lead';

-- What a student is studying this year. A student who does Level 1, Level 2
-- and a Bachelor has three of these. Their Level 1 row points at a department
-- class; the later ones point at their specialisation. The choice of
-- specialisation is therefore recorded by which class they joined at Level 2,
-- and cannot drift out of step with where they actually sit.
CREATE TABLE enrolments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES students(person_id) ON DELETE RESTRICT,
  class_id      uuid NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,

  -- Per student, not per class: online and on-campus students sit in the same
  -- class, but you need this list every exam period, because these are the
  -- people who must travel in for exams and defence.
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

-- ---------------------------------------------------------------------------
--  ADMISSIONS — one funnel, not three tables
--
--  A curious visitor, an applicant and an accepted candidate are the same
--  person pursuing the same thing at three moments. Splitting them into
--  separate tables means copying ten fields twice and letting them drift, so
--  there is one row that changes `stage` as it advances.
-- ---------------------------------------------------------------------------
CREATE TABLE admissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Null until the candidate is accepted and a person record is created. This
  -- is the moment a lead stops being a stranger and becomes somebody WIPEG
  -- holds a file on.
  person_id           uuid REFERENCES persons(id) ON DELETE RESTRICT,

  stage               text NOT NULL DEFAULT 'lead'
                        CHECK (stage IN ('lead', 'applied', 'reviewing',
                                         'offered', 'accepted', 'enrolled',
                                         'rejected', 'withdrawn', 'lost')),

  -- What they are applying for. At Level 1 they apply to a department and the
  -- specialisation is only a preference, which is what makes next year's
  -- Level 2 class sizes predictable.
  campus_id           uuid NOT NULL REFERENCES campuses(id) ON DELETE RESTRICT,
  department_id       uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  specialisation_id   uuid,
  level_applied       smallint NOT NULL REFERENCES levels(level) ON DELETE RESTRICT,
  academic_year_id    uuid NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  delivery_mode       text NOT NULL DEFAULT 'on_campus'
                        CHECK (delivery_mode IN ('on_campus', 'online')),

  -- Entering above Level 1 means joining a specialisation directly, so it has
  -- to be named.
  CONSTRAINT specialisation_required_above_level_one CHECK (
    level_applied = 1 OR specialisation_id IS NOT NULL
  ),

  FOREIGN KEY (specialisation_id, department_id)
    REFERENCES specialisations (id, department_id) ON DELETE RESTRICT,

  -- What they typed at the time, kept exactly as submitted even if the person
  -- record is later corrected. This is the record of what was claimed.
  surname             text NOT NULL,
  given_names         text NOT NULL,
  phone               text NOT NULL CHECK (phone ~ '^\+[0-9]{8,15}$'),
  email               text,
  prior_qualification text,                  -- 'GCE A/L', 'HND', 'Baccalaureat'

  source              text CHECK (source IN ('website', 'whatsapp', 'facebook',
                                             'flier', 'referral', 'walk_in',
                                             'radio', 'other')),

  stage_changed_at    timestamptz NOT NULL DEFAULT now(),
  decided_at          timestamptz,
  decided_by          text,
  notes               text,

  submitted_at        timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- Cannot be accepted or enrolled without a person record behind it.
  CHECK (stage NOT IN ('accepted', 'enrolled') OR person_id IS NOT NULL)
);

CREATE TRIGGER admissions_touch BEFORE UPDATE ON admissions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX admissions_stage       ON admissions (stage);
CREATE INDEX admissions_phone       ON admissions (phone);
CREATE INDEX admissions_year        ON admissions (academic_year_id);
CREATE INDEX admissions_campus      ON admissions (campus_id);
CREATE INDEX admissions_department  ON admissions (department_id);
CREATE INDEX admissions_person      ON admissions (person_id);

-- Every time somebody chases a lead. Without this the registry cannot tell a
-- cold lead from one nobody has called yet.
CREATE TABLE admission_contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id  uuid NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  contacted_at  timestamptz NOT NULL DEFAULT now(),
  channel       text NOT NULL CHECK (channel IN ('whatsapp', 'call', 'sms',
                                                 'email', 'in_person')),
  outcome       text CHECK (outcome IN ('reached', 'no_answer', 'promised_visit',
                                        'not_interested', 'wrong_number')),
  note          text,
  recorded_by   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admission_contacts_admission ON admission_contacts (admission_id, contacted_at DESC);


-- ###########################################################################
--  LAYER 5 — MONEY
--
--  Amounts are whole francs in `bigint`. XAF has no subunit, so an integer is
--  already exact — the usual reason for DECIMAL does not arise. See DESIGN.md.
-- ###########################################################################

-- What a given group is charged in a given year. Different programmes have
-- their own fees, so this is keyed the same way a class is: department-wide at
-- Level 1, per specialisation above it.
CREATE TABLE fee_schedules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id  uuid NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  department_id     uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  specialisation_id uuid,
  level             smallint NOT NULL REFERENCES levels(level) ON DELETE RESTRICT,

  tuition_total     bigint NOT NULL CHECK (tuition_total > 0),
  currency          text NOT NULL DEFAULT 'XAF' CHECK (currency = 'XAF'),

  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fee_level_one_is_department_wide CHECK (
    (level = 1 AND specialisation_id IS NULL) OR
    (level > 1 AND specialisation_id IS NOT NULL)
  ),

  FOREIGN KEY (specialisation_id, department_id)
    REFERENCES specialisations (id, department_id) ON DELETE RESTRICT
);

CREATE TRIGGER fee_schedules_touch BEFORE UPDATE ON fee_schedules
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE UNIQUE INDEX fee_schedules_unique_level_one
  ON fee_schedules (academic_year_id, department_id, level)
  WHERE specialisation_id IS NULL;

CREATE UNIQUE INDEX fee_schedules_unique_specialised
  ON fee_schedules (academic_year_id, specialisation_id, level)
  WHERE specialisation_id IS NOT NULL;

CREATE INDEX fee_schedules_year ON fee_schedules (academic_year_id);

-- The three installments. Kept as rows rather than as first_amount,
-- second_amount, third_amount columns, so that a programme charging two or
-- four needs no change to the schema.
CREATE TABLE fee_schedule_installments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_schedule_id   uuid NOT NULL REFERENCES fee_schedules(id) ON DELETE CASCADE,
  sequence          smallint NOT NULL CHECK (sequence BETWEEN 1 AND 6),
  label             text NOT NULL,           -- 'First installment'
  amount            bigint NOT NULL CHECK (amount > 0),
  due_on            date NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (fee_schedule_id, sequence)
);

CREATE INDEX fee_schedule_installments_schedule ON fee_schedule_installments (fee_schedule_id);

-- What THIS student owes for THIS enrolment — copied from the schedule at the
-- moment they enrol, never looked up live. If fees rise next August, last
-- year's students keep the figures they agreed to. This snapshot is the whole
-- reason the table exists.
CREATE TABLE student_charges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrolment_id  uuid NOT NULL REFERENCES enrolments(id) ON DELETE RESTRICT,
  sequence      smallint NOT NULL CHECK (sequence BETWEEN 1 AND 6),
  label         text NOT NULL,
  amount_due    bigint NOT NULL CHECK (amount_due > 0),
  due_on        date NOT NULL,
  waived        boolean NOT NULL DEFAULT false,
  waiver_reason text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (enrolment_id, sequence),
  CHECK (NOT waived OR waiver_reason IS NOT NULL)
);

CREATE TRIGGER student_charges_touch BEFORE UPDATE ON student_charges
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX student_charges_enrolment ON student_charges (enrolment_id);
CREATE INDEX student_charges_due       ON student_charges (due_on) WHERE NOT waived;

-- Money that actually moved. Three figures, because with Mobile Money they are
-- three different numbers and confusing them is how books stop balancing:
--
--   amount_charged  left the student's wallet
--   provider_fee    MTN or Orange kept this  (the student bears it)
--   amount_received reached WIPEG — the only figure that reduces a balance
--
-- Never updated after the fact. A mistake is corrected by a reversing row.
CREATE TABLE payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES students(person_id) ON DELETE RESTRICT,
  enrolment_id      uuid REFERENCES enrolments(id) ON DELETE RESTRICT,

  method            text NOT NULL CHECK (method IN ('mtn_momo', 'orange_money',
                                                    'bank_transfer', 'card', 'cash')),

  amount_charged    bigint NOT NULL CHECK (amount_charged > 0),
  provider_fee      bigint NOT NULL DEFAULT 0 CHECK (provider_fee >= 0),
  amount_received   bigint NOT NULL CHECK (amount_received > 0),
  currency          text NOT NULL DEFAULT 'XAF' CHECK (currency = 'XAF'),

  -- The provider's own reference. UNIQUE is what makes the payment webhook
  -- safe to retry: the same notification arriving twice cannot be banked twice.
  provider_reference text UNIQUE,

  status            text NOT NULL DEFAULT 'succeeded'
                      CHECK (status IN ('pending', 'succeeded', 'failed', 'reversed')),

  paid_at           timestamptz NOT NULL DEFAULT now(),
  recorded_by       text,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CHECK (amount_charged = amount_received + provider_fee)
);

CREATE INDEX payments_student   ON payments (student_id);
CREATE INDEX payments_enrolment ON payments (enrolment_id);
CREATE INDEX payments_paid_at   ON payments (paid_at DESC);

-- Which installment a payment settled. A single transfer often clears the
-- remainder of one installment and part of the next, and without this table
-- nobody could say which.
CREATE TABLE payment_allocations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id        uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  student_charge_id uuid NOT NULL REFERENCES student_charges(id) ON DELETE RESTRICT,
  amount            bigint NOT NULL CHECK (amount > 0),
  created_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (payment_id, student_charge_id)
);

CREATE INDEX payment_allocations_charge ON payment_allocations (student_charge_id);


-- ###########################################################################
--  SEED — the parts that are facts, not data entry
-- ###########################################################################

INSERT INTO awards (code, name, name_fr, rank) VALUES
  ('HND',      'HND / BTS', 'BTS / HND', 1),
  ('BACHELOR', 'Bachelor',  'Licence',   2),
  ('MASTER',   'Master',    'Master',    3);

INSERT INTO levels (level, award_id, name)
SELECT v.level, a.id, v.name
FROM (VALUES
  (1::smallint, 'HND',      'Level 1'),
  (2::smallint, 'HND',      'Level 2'),
  (3::smallint, 'BACHELOR', 'Level 3'),
  (4::smallint, 'MASTER',   'Level 4'),
  (5::smallint, 'MASTER',   'Level 5')
) AS v(level, award_code, name)
JOIN awards a ON a.code = v.award_code;


-- ###########################################################################
--  VIEWS — the everyday questions, answered once
-- ###########################################################################

-- Everyone currently studying, with where and what. `specialisation` reads
-- "Level 1 (shared)" for first-years, who have not chosen yet.
CREATE VIEW current_students AS
SELECT
  s.person_id         AS student_id,
  s.matricule,
  p.surname,
  p.given_names,
  p.phone,
  p.school_email,
  date_part('year', age(p.date_of_birth))::int AS age,
  c.name              AS campus,
  d.name              AS department,
  COALESCE(sp.name, 'Level 1 (shared)') AS specialisation,
  cl.level,
  aw.name             AS award,
  ay.label            AS academic_year,
  e.delivery_mode,
  e.id                AS enrolment_id,
  cl.id               AS class_id
FROM enrolments e
JOIN students         s  ON s.person_id = e.student_id
JOIN persons          p  ON p.id  = s.person_id
JOIN classes          cl ON cl.id = e.class_id
JOIN campuses         c  ON c.id  = cl.campus_id
JOIN departments      d  ON d.id  = cl.department_id
LEFT JOIN specialisations sp ON sp.id = cl.specialisation_id   -- null at Level 1
JOIN levels           l  ON l.level = cl.level
JOIN awards           aw ON aw.id = l.award_id
JOIN academic_years   ay ON ay.id = cl.academic_year_id
WHERE e.status = 'active';

-- The list you want every exam period: who has to travel in.
CREATE VIEW online_students_for_exams AS
SELECT * FROM current_students WHERE delivery_mode = 'online';

-- Who teaches what, where, and when — a lecturer's timetable, and equally the
-- answer to "who is taking Level 2 Nursing this term?".
CREATE VIEW teaching_load AS
SELECT
  st.person_id        AS staff_id,
  p.surname,
  p.given_names,
  p.school_email,
  ta.role,
  co.id               AS course_offering_id,
  crs.code            AS course_code,
  crs.title           AS course_title,
  cmp.name            AS campus,
  d.name              AS department,
  COALESCE(sp.name, 'Level 1 (shared)') AS specialisation,
  cl.level,
  t.name              AS term,
  ay.label            AS academic_year,
  co.google_course_id
FROM teaching_assignments ta
JOIN staff            st  ON st.person_id = ta.staff_id
JOIN persons          p   ON p.id = st.person_id
JOIN course_offerings co  ON co.id = ta.course_offering_id
JOIN courses          crs ON crs.id = co.course_id
JOIN classes          cl  ON cl.id = co.class_id
JOIN campuses         cmp ON cmp.id = cl.campus_id
JOIN departments      d   ON d.id = cl.department_id
LEFT JOIN specialisations sp ON sp.id = cl.specialisation_id
JOIN terms            t   ON t.id = co.term_id
JOIN academic_years   ay  ON ay.id = co.academic_year_id;

-- FEES STATUS. Not a column anywhere — this is the answer, recomputed on
-- every read from what was charged and what arrived.
CREATE VIEW fee_status AS
SELECT
  e.id                AS enrolment_id,
  e.student_id,
  p.surname,
  p.given_names,
  p.phone,
  s.matricule,
  COALESCE(charged.total, 0)              AS total_charged,
  COALESCE(paid.total, 0)                 AS total_paid,
  COALESCE(charged.total, 0) - COALESCE(paid.total, 0) AS balance,
  charged.next_due_on,
  CASE
    WHEN COALESCE(charged.total, 0) - COALESCE(paid.total, 0) <= 0 THEN 'paid'
    WHEN charged.overdue_total > COALESCE(paid.total, 0)           THEN 'overdue'
    WHEN charged.next_due_on <= CURRENT_DATE + 14                  THEN 'due_soon'
    ELSE 'on_track'
  END                                     AS status
FROM enrolments e
JOIN students s ON s.person_id = e.student_id
JOIN persons  p ON p.id = s.person_id
LEFT JOIN LATERAL (
  SELECT
    sum(sc.amount_due)                                          AS total,
    min(sc.due_on) FILTER (WHERE sc.due_on >= CURRENT_DATE)     AS next_due_on,
    COALESCE(sum(sc.amount_due) FILTER (WHERE sc.due_on < CURRENT_DATE), 0) AS overdue_total
  FROM student_charges sc
  WHERE sc.enrolment_id = e.id AND NOT sc.waived
) charged ON true
LEFT JOIN LATERAL (
  SELECT sum(pa.amount) AS total
  FROM payment_allocations pa
  JOIN student_charges sc2 ON sc2.id = pa.student_charge_id
  JOIN payments pm         ON pm.id = pa.payment_id
  WHERE sc2.enrolment_id = e.id AND pm.status = 'succeeded'
) paid ON true
WHERE e.status = 'active';

-- Who to chase, most overdue first. `phone` is here so the admin page can
-- build a wa.me link without a second query.
CREATE VIEW fee_arrears AS
SELECT * FROM fee_status WHERE status = 'overdue' ORDER BY balance DESC;

-- The admissions funnel: how many people are at each stage, and where.
CREATE VIEW admissions_funnel AS
SELECT
  ay.label      AS academic_year,
  c.name        AS campus,
  d.name        AS department,
  a.stage,
  count(*)      AS candidates,
  count(*) FILTER (WHERE ac.last_contact IS NULL) AS never_contacted
FROM admissions a
JOIN academic_years ay ON ay.id = a.academic_year_id
JOIN campuses       c  ON c.id = a.campus_id
JOIN departments    d  ON d.id = a.department_id
LEFT JOIN LATERAL (
  SELECT max(contacted_at) AS last_contact
  FROM admission_contacts
  WHERE admission_id = a.id
) ac ON true
GROUP BY ay.label, c.name, d.name, a.stage;

-- Level 1 candidates and the specialisation they said they wanted, so next
-- year's Level 2 classes can be sized before they have to be created.
CREATE VIEW level_one_specialisation_interest AS
SELECT
  c.name              AS campus,
  d.name              AS department,
  COALESCE(sp.name, 'Undecided') AS intended_specialisation,
  count(*)            AS candidates
FROM admissions a
JOIN campuses       c  ON c.id = a.campus_id
JOIN departments    d  ON d.id = a.department_id
LEFT JOIN specialisations sp ON sp.id = a.specialisation_id
WHERE a.level_applied = 1
  AND a.stage IN ('lead', 'applied', 'reviewing', 'offered', 'accepted', 'enrolled')
GROUP BY c.name, d.name, COALESCE(sp.name, 'Undecided');

-- Gaps the registry should fill. Mandatory-for-students fields live on the
-- shared `persons` table, where NOT NULL would also bind staff, so they are
-- checked here instead. See DESIGN.md, "What is not enforced".
CREATE VIEW students_missing_required_data AS
SELECT
  s.person_id AS student_id,
  p.surname,
  p.given_names,
  p.phone,
  s.matricule IS NULL       AS no_matricule,
  p.date_of_birth IS NULL   AS no_date_of_birth,
  NOT EXISTS (SELECT 1 FROM documents dc
              WHERE dc.person_id = s.person_id AND dc.kind = 'photo') AS no_photo
FROM students s
JOIN persons p ON p.id = s.person_id
WHERE s.status = 'active'
  AND (s.matricule IS NULL
       OR p.date_of_birth IS NULL
       OR NOT EXISTS (SELECT 1 FROM documents dc
                      WHERE dc.person_id = s.person_id AND dc.kind = 'photo'));

-- Fee schedules whose installments do not add up to the total. SQL cannot
-- check a sum across rows declaratively, so it is checked here and this view
-- should always be empty.
CREATE VIEW fee_schedules_unbalanced AS
SELECT
  fs.id,
  ay.label            AS academic_year,
  d.name              AS department,
  COALESCE(sp.name, 'Level 1 (shared)') AS specialisation,
  fs.level,
  fs.tuition_total,
  COALESCE(sum(fsi.amount), 0) AS installments_total
FROM fee_schedules fs
JOIN academic_years ay ON ay.id = fs.academic_year_id
JOIN departments    d  ON d.id = fs.department_id
LEFT JOIN specialisations sp ON sp.id = fs.specialisation_id
LEFT JOIN fee_schedule_installments fsi ON fsi.fee_schedule_id = fs.id
GROUP BY fs.id, ay.label, d.name, sp.name, fs.level, fs.tuition_total
HAVING COALESCE(sum(fsi.amount), 0) <> fs.tuition_total;


-- ###########################################################################
--  ROW LEVEL SECURITY
--
--  Every table is locked and no policy is created, so the anon and
--  authenticated Supabase keys can read nothing at all. The application
--  reaches this database only from the server, with the service role, which
--  bypasses RLS. If a publishable key ever leaks into browser JavaScript,
--  it opens nothing. Policies get added when, and only when, students are
--  given direct logins.
-- ###########################################################################

ALTER TABLE campuses                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE awards                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE levels                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialisations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years           ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE students                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_departments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents                ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_offerings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE teaching_assignments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrolments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_contacts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_schedules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_schedule_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_charges          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations      ENABLE ROW LEVEL SECURITY;

COMMIT;
