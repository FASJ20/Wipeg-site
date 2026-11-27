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
--    5. MONEY       what is owed and received — append-only, never edited
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
--     charges minus receipts, computed on read by the `fee_status` view. A
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

  -- Google's own id for that Workspace account, filled on first sign-in.
  -- Sign-in matches on this rather than on school_email, because an
  -- address can be changed in the Admin console and this cannot. A person
  -- who has never signed in has a school_email and a null google_sub.
  google_sub        text UNIQUE,
  last_signed_in_at timestamptz,

  -- For signing in with a password instead of Google. Null for anyone who
  -- only ever uses Google, which is most staff. Never the password itself:
  -- this is a scrypt hash and cannot be turned back into one.
  password_hash     text,

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

-- WIPEG has three kinds of user, and this table holds the only one of them
-- that can be handed out:
--
--   student   a row in `students`
--   lecturer  a row in `staff`  — that is all it takes; no grant needed
--   admin     a row in `staff`  AND a live 'admin' grant here
--
-- Being a lecturer is not granted, because it is simply what a staff row
-- means. Admin is granted, and only an existing admin can do it.
--
-- Kept as a table rather than a boolean on `staff` for one reason: a grant
-- carries the date and the person who made it, and is revoked by date rather
-- than deleted. "Who could change the fees last March" is a question that
-- gets asked after the fact. See db/API.md for what each role can reach.
CREATE TABLE staff_roles (
  staff_id      uuid NOT NULL REFERENCES staff(person_id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('admin')),
  granted_on    date NOT NULL DEFAULT CURRENT_DATE,
  granted_by    uuid REFERENCES staff(person_id) ON DELETE RESTRICT,
  revoked_on    date,
  created_at    timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (staff_id, role),
  CHECK (revoked_on IS NULL OR revoked_on >= granted_on)
);

-- The one index authorisation needs: every request turns a signed-in person
-- into "is this an admin?".
CREATE INDEX staff_roles_live ON staff_roles (staff_id) WHERE revoked_on IS NULL;

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
--  NO ADMISSIONS FUNNEL, AND NO APPOINTMENTS TABLE
--
--  Earlier drafts carried an `admissions` lead pipeline and an `appointments`
--  table for calls booked from the website. Both are gone, deliberately.
--
--  Leads: WIPEG does not run a sales pipeline, and a half-used CRM is worse
--  than none -- stages nobody advances, rotting in a table. Enquiries reach
--  the registry by phone and WhatsApp, which is where they were already being
--  answered.
--
--  Bookings: Google Calendar IS the booking system. The website writes the
--  event straight to a shared WIPEG calendar and reads free/busy back out of
--  it; nothing is mirrored here. One source of truth, and staff move or
--  cancel a call from the phone already in their hand rather than a screen
--  they would have to be taught. See db/API.md, "Booking a call".
--
--  A person therefore enters this database for the first time at enrolment.
-- ---------------------------------------------------------------------------

-- ###########################################################################
--  LAYER 5 — MONEY
--
--  Amounts are whole francs in `bigint`. XAF has no subunit, so an integer is
--  already exact — the usual reason for DECIMAL does not arise. See DESIGN.md.
--
--  NO MONEY MOVES THROUGH THIS SYSTEM. Fees are paid at the bursary, into the
--  bank, or by Mobile Money to WIPEG's own number. This layer records what was
--  agreed and what arrived; it never takes a payment. There is therefore no
--  gateway, no webhook, no card data and no stored account number.
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

-- Money WIPEG has already received. No payment is taken on this system: a
-- student pays at the bursary, into the bank, or by Mobile Money to WIPEG's
-- own number, and the bursar enters what came in. So there is no provider
-- fee, no gateway reference and no 'pending' state — the money is in hand
-- before the row exists, which is why a single `amount` is enough.
CREATE TABLE fee_receipts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrolment_id    uuid NOT NULL REFERENCES enrolments(id) ON DELETE RESTRICT,

  -- The number on the paper receipt or the bank slip. UNIQUE is the only
  -- defence against the same payment being keyed in twice by two people.
  receipt_no      text UNIQUE,

  amount          bigint NOT NULL,
  currency        text NOT NULL DEFAULT 'XAF' CHECK (currency = 'XAF'),

  -- Where the money was handed over. Recorded so the bursar can reconcile
  -- against the bank statement and the MoMo history — it is a note about
  -- something that already happened, not an integration.
  method          text NOT NULL CHECK (method IN ('cash', 'bank_deposit', 'mtn_momo',
                                                  'orange_money', 'cheque', 'other')),
  bank_reference  text,
  received_on     date NOT NULL,

  -- Append-only, like any ledger. A receipt keyed in wrongly is cancelled by
  -- a second row carrying the negative amount and pointing at the mistake, so
  -- a balance stays a plain sum and the error is still visible a year later.
  reverses_id     uuid UNIQUE REFERENCES fee_receipts(id) ON DELETE RESTRICT,
  reversal_reason text,

  recorded_by     uuid REFERENCES staff(person_id) ON DELETE RESTRICT,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT receipt_positive_unless_reversing CHECK (
    (reverses_id IS NULL     AND amount > 0 AND receipt_no IS NOT NULL) OR
    (reverses_id IS NOT NULL AND amount < 0 AND reversal_reason IS NOT NULL)
  )
);

CREATE INDEX fee_receipts_enrolment ON fee_receipts (enrolment_id);
CREATE INDEX fee_receipts_received  ON fee_receipts (received_on DESC);

-- A receipt is deliberately NOT tied to a particular installment. A student
-- hands over 75,000 francs; which installment that clears is arithmetic, not
-- a decision, and `fee_status` settles the oldest unwaived charge first. An
-- allocations table would make the bursar answer a question the schedule has
-- already answered. See DESIGN.md, "where I deliberately did not normalise".


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
CREATE TABLE grading_scale (
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
CREATE TABLE results (
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

CREATE TRIGGER results_touch BEFORE UPDATE ON results
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX results_enrolment ON results (enrolment_id);
CREATE INDEX results_offering  ON results (course_offering_id, status);

-- One meeting of one subject. Attendance hangs off a session rather than a
-- date, because a subject can meet twice in a day and those are two
-- different registers.
CREATE TABLE class_sessions (
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

CREATE INDEX class_sessions_offering ON class_sessions (course_offering_id, held_on DESC);

-- Who was there. One row per student per session.
CREATE TABLE attendance (
  session_id  uuid NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES students(person_id) ON DELETE RESTRICT,

  status      text NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  note        text,
  marked_by   uuid REFERENCES staff(person_id) ON DELETE RESTRICT,
  marked_at   timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (session_id, student_id)
);

CREATE INDEX attendance_student ON attendance (student_id);


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
  ('F',   0.00, 0.00, false, 'Fail');


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
  -- A reversal carries a negative amount, so the plain sum is already net of
  -- corrections. No status filter is needed: money that never arrived has no row.
  SELECT sum(r.amount) AS total
  FROM fee_receipts r
  WHERE r.enrolment_id = e.id
) paid ON true
WHERE e.status = 'active';

-- Who to chase, most overdue first. `phone` is here so the admin page can
-- build a wa.me link without a second query.
CREATE VIEW fee_arrears AS
SELECT * FROM fee_status WHERE status = 'overdue' ORDER BY balance DESC;

-- What came in, by day and by method, for reconciling the cash box against
-- the bank statement. Reversals net themselves out, being negative.
CREATE VIEW fee_collections_by_day AS
SELECT
  r.received_on,
  r.method,
  count(*)      AS receipts,
  sum(r.amount) AS total
FROM fee_receipts r
GROUP BY r.received_on, r.method;

-- A student's published results, with the total and grade worked out on
-- read. Nothing here is stored, so changing the weighting or the pass mark
-- makes every past result re-read correctly.
CREATE VIEW student_results AS
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
CREATE VIEW attendance_summary AS
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


-- ---------------------------------------------------------------------------
--  ACCOUNT REQUESTS — people asking to join, before anybody says yes
--
--  Self-registration writes here, NOT into `persons`. Nothing in this table
--  grants anything: a row is a request, and an admin turning it into a real
--  person row is the moment access begins.
--
--  That separation is the whole point. If registration wrote straight into
--  `staff` plus a role grant, anybody who found the address would be an
--  administrator of WIPEG's student records. Here, the worst a stranger can
--  do is add a row to a queue.
-- ---------------------------------------------------------------------------
CREATE TABLE account_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  kind            text NOT NULL CHECK (kind IN ('student', 'lecturer', 'admin')),

  surname         text NOT NULL,
  given_names     text NOT NULL,
  email           text NOT NULL,
  phone           text NOT NULL CHECK (phone ~ '^\+[0-9]{8,15}$'),

  -- scrypt. Carried over to persons.password_hash on approval, so the person
  -- signs in with the password they chose and is never sent one by email.
  password_hash   text NOT NULL,

  -- What a student is applying for. Null for staff, who are not applying to
  -- study anything.
  campus_id       uuid REFERENCES campuses(id)     ON DELETE RESTRICT,
  department_id   uuid REFERENCES departments(id)  ON DELETE RESTRICT,
  level_applied   smallint REFERENCES levels(level) ON DELETE RESTRICT,

  -- Staff say what they teach or do; students can say anything they like.
  message         text,

  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),

  reviewed_by     uuid REFERENCES staff(person_id) ON DELETE RESTRICT,
  reviewed_at     timestamptz,
  reject_reason   text,

  -- Filled in when approved: the person record this became.
  person_id       uuid REFERENCES persons(id) ON DELETE RESTRICT,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CHECK (status <> 'rejected' OR reject_reason IS NOT NULL),
  CHECK (status <> 'approved' OR person_id IS NOT NULL),
  CHECK (status =  'pending'  OR reviewed_at IS NOT NULL)
);

CREATE TRIGGER account_requests_touch BEFORE UPDATE ON account_requests
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- One open request per email address. Somebody who registers twice by
-- accident gets told so, instead of creating two queue entries that two
-- different admins then approve.
CREATE UNIQUE INDEX account_requests_one_open_per_email
  ON account_requests (lower(email)) WHERE status = 'pending';

CREATE INDEX account_requests_queue ON account_requests (status, kind, created_at);

-- ###########################################################################
--  LAYER 6 — THE RECORD
--
--  WIPEG runs one Admin role. Whoever can enter a receipt can also change a
--  matricule and a fee schedule, which is a fair trade at this size but
--  removes separation of duties entirely. This table is what replaces it: if
--  anyone can do anything, the record of who actually did what is the only
--  control left.
--
--  Append-only. The API never issues UPDATE or DELETE against it, and a row
--  keeps the actor's email as text so the entry still names somebody after
--  the person record is gone.
-- ###########################################################################

CREATE TABLE audit_log (
  id           bigserial PRIMARY KEY,
  at           timestamptz NOT NULL DEFAULT now(),

  -- Null for an action taken by a timed job or by an unauthenticated caller.
  actor_id     uuid REFERENCES persons(id) ON DELETE SET NULL,
  -- Copied at write time on purpose: see above.
  actor_email  text,
  actor_role   text CHECK (actor_role IN ('admin', 'lecturer', 'student', 'job', 'public')),

  action       text NOT NULL,          -- 'enrol', 'record_receipt', 'grant_role'
  entity       text NOT NULL,          -- the table or concept acted on
  entity_id    text,                   -- text, since not every key is a uuid

  summary      text NOT NULL,          -- one line, readable without the diff
  before       jsonb,
  after        jsonb,

  ip           inet,
  user_agent   text
);

CREATE INDEX audit_log_at     ON audit_log (at DESC);
CREATE INDEX audit_log_actor  ON audit_log (actor_id, at DESC);
CREATE INDEX audit_log_entity ON audit_log (entity, entity_id, at DESC);

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

ALTER TABLE grading_scale            ENABLE ROW LEVEL SECURITY;
ALTER TABLE results                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance               ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_requests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log                ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE staff_roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents                ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_offerings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE teaching_assignments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrolments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_schedules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_schedule_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_charges          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_receipts             ENABLE ROW LEVEL SECURITY;

COMMIT;
