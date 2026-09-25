-- ============================================================================
--  WIPEG — undo db/schema.sql, completely.
--
--  Run:  psql "$DATABASE_URL" -f db/rollback.sql
--
--  This DESTROYS every student, payment and admission record. It exists so the
--  baseline can be rebuilt while nothing real is in the database yet, and so
--  the test harness can start from clean. Once WIPEG has live data, changes
--  are made by numbered migrations in db/migrations/, never by running this.
-- ============================================================================

BEGIN;

DROP VIEW IF EXISTS fee_schedules_unbalanced;
DROP VIEW IF EXISTS students_missing_required_data;
DROP VIEW IF EXISTS level_one_specialisation_interest;
DROP VIEW IF EXISTS admissions_funnel;
DROP VIEW IF EXISTS fee_arrears;
DROP VIEW IF EXISTS fee_status;
DROP VIEW IF EXISTS teaching_load;
DROP VIEW IF EXISTS online_students_for_exams;
DROP VIEW IF EXISTS current_students;

-- Reverse order of creation: money, then delivery, then people, then calendar,
-- then catalogue. CASCADE is deliberate — it also removes the triggers.
DROP TABLE IF EXISTS payment_allocations       CASCADE;
DROP TABLE IF EXISTS payments                  CASCADE;
DROP TABLE IF EXISTS student_charges           CASCADE;
DROP TABLE IF EXISTS fee_schedule_installments CASCADE;
DROP TABLE IF EXISTS fee_schedules             CASCADE;

DROP TABLE IF EXISTS admission_contacts        CASCADE;
DROP TABLE IF EXISTS admissions                CASCADE;
DROP TABLE IF EXISTS enrolments                CASCADE;
DROP TABLE IF EXISTS teaching_assignments      CASCADE;
DROP TABLE IF EXISTS course_offerings          CASCADE;
DROP TABLE IF EXISTS classes                   CASCADE;

DROP TABLE IF EXISTS documents                 CASCADE;
DROP TABLE IF EXISTS staff_departments         CASCADE;
DROP TABLE IF EXISTS staff                     CASCADE;
DROP TABLE IF EXISTS students                  CASCADE;
DROP TABLE IF EXISTS persons                   CASCADE;

DROP TABLE IF EXISTS terms                     CASCADE;
DROP TABLE IF EXISTS academic_years            CASCADE;

DROP TABLE IF EXISTS curriculum_entries        CASCADE;
DROP TABLE IF EXISTS courses                   CASCADE;
DROP TABLE IF EXISTS specialisations           CASCADE;
DROP TABLE IF EXISTS levels                    CASCADE;
DROP TABLE IF EXISTS awards                    CASCADE;
DROP TABLE IF EXISTS departments               CASCADE;
DROP TABLE IF EXISTS campuses                  CASCADE;

DROP FUNCTION IF EXISTS touch_updated_at();

COMMIT;
