-- ============================================================================
--  Migration 001 — self-registration and password sign-in
--
--  Run this ONCE, in the Supabase SQL Editor, on a database that already has
--  db/schema.sql applied. It adds what changed after that first import:
--
--    * persons.password_hash  — for signing in without Google
--    * account_requests       — people asking to join, before anybody says yes
--
--  Safe to run twice. Every statement checks first, so a second run reports
--  success and changes nothing.
-- ============================================================================

BEGIN;

-- ------------------------------------------------- a password on the person
ALTER TABLE persons
  ADD COLUMN IF NOT EXISTS password_hash text;

COMMENT ON COLUMN persons.password_hash IS
  'scrypt hash. Null for anyone who only signs in with Google. Never the password itself.';


-- ------------------------------------------- people asking to join, in a queue
--
--  Self-registration writes HERE, not into `persons`. A row grants nothing:
--  an admin turning it into a real person row is the moment access begins.
--
--  That separation is the point. If registration wrote straight into `staff`
--  plus a role grant, anybody who found the address would be an administrator
--  of WIPEG's student records. Here the worst a stranger can do is join a list.
--
CREATE TABLE IF NOT EXISTS account_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  kind            text NOT NULL CHECK (kind IN ('student', 'lecturer', 'admin')),

  surname         text NOT NULL,
  given_names     text NOT NULL,
  email           text NOT NULL,
  phone           text NOT NULL CHECK (phone ~ '^\+[0-9]{8,15}$'),

  -- Carried over to persons.password_hash on approval, so the person signs in
  -- with the password they chose and is never sent one by email.
  password_hash   text NOT NULL,

  -- What a student is applying for. Null for staff.
  campus_id       uuid REFERENCES campuses(id)      ON DELETE RESTRICT,
  department_id   uuid REFERENCES departments(id)   ON DELETE RESTRICT,
  level_applied   smallint REFERENCES levels(level) ON DELETE RESTRICT,

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

-- CREATE TRIGGER has no IF NOT EXISTS, so it is dropped first to stay re-runnable.
DROP TRIGGER IF EXISTS account_requests_touch ON account_requests;
CREATE TRIGGER account_requests_touch BEFORE UPDATE ON account_requests
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- One open request per email. Somebody who registers twice by accident is
-- told so, instead of creating two entries two different admins then approve.
CREATE UNIQUE INDEX IF NOT EXISTS account_requests_one_open_per_email
  ON account_requests (lower(email)) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS account_requests_queue
  ON account_requests (status, kind, created_at);

-- Locked like every other table: the anon key reads nothing. The backend
-- reaches this database server-side only.
ALTER TABLE account_requests ENABLE ROW LEVEL SECURITY;

COMMIT;


-- ----------------------------------------------------------------- check it
-- Run this afterwards. Expect: 25 tables, and password_hash = 1.
--
--   SELECT
--     (SELECT count(*) FROM information_schema.tables
--       WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tables,
--     (SELECT count(*) FROM information_schema.columns
--       WHERE table_name = 'persons' AND column_name = 'password_hash') AS password_hash;
