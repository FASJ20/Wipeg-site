"""Prove the schema's rules hold, against a real PostgreSQL.

Starts a throwaway PostgreSQL, applies db/schema.sql, then tries to break
every rule the design claims to enforce.

    python -m pip install pgserver
    python db/test_rules.py

psql() prints errors to stderr and returns '' rather than raising, so each
test checks the EFFECT: did the row actually appear or not?
"""
import contextlib
import io
import pathlib
import re
import sys
import tempfile

import pgserver

SCHEMA = pathlib.Path(__file__).with_name("schema.sql")

db = pgserver.get_server(tempfile.mkdtemp(prefix="wipegtest"))
db.psql(SCHEMA.read_text(encoding="utf-8"))

passed = failed = 0


def count(table):
    return int(re.search(r"\d+", db.psql(f"SELECT count(*) FROM {table};")).group())


def run_quietly(sql):
    """Swallow the expected psql error noise so the report stays readable."""
    with contextlib.redirect_stderr(io.StringIO()):
        db.psql(sql)


def check(label, table, sql, expect_insert):
    global passed, failed
    before = count(table)
    run_quietly(sql)
    inserted = count(table) > before
    if inserted == expect_insert:
        passed += 1
        print(f"  PASS  {label}")
    else:
        failed += 1
        verb = ("was rejected but should have worked" if expect_insert
                else "was ALLOWED but should have been rejected")
        print(f"  FAIL  {label}  -  {verb}")


def allowed(label, table, sql):
    check(label, table, sql, True)


def rejected(label, table, sql):
    check(label, table, sql, False)


# --- seed --------------------------------------------------------------------
db.psql("""
INSERT INTO campuses (code, name, region, is_main) VALUES
  ('GRA', 'Garoua', 'North Region', true),
  ('YDE', 'Yaounde', 'Centre Region', false);
INSERT INTO departments (slug, code, name) VALUES
  ('computer-engineering', 'CEN', 'Computer Engineering'),
  ('medical-biomedical-sciences', 'MED', 'Medical and Biomedical Sciences');
INSERT INTO specialisations (department_id, code, name)
  SELECT id, 'SWE', 'Software Engineering' FROM departments WHERE code = 'CEN';
INSERT INTO specialisations (department_id, code, name)
  SELECT id, 'NUR', 'Nursing' FROM departments WHERE code = 'MED';
INSERT INTO academic_years (label, starts_on, ends_on, is_current) VALUES
  ('2026/27', '2026-10-01', '2027-07-31', true),
  ('2027/28', '2027-10-01', '2028-07-31', false);
INSERT INTO terms (academic_year_id, term_no, name, starts_on, ends_on)
  SELECT id, 1, 'First semester', '2026-10-01', '2027-02-15'
  FROM academic_years WHERE label = '2026/27';
INSERT INTO terms (academic_year_id, term_no, name, starts_on, ends_on)
  SELECT id, 1, 'First semester', '2027-10-01', '2028-02-15'
  FROM academic_years WHERE label = '2027/28';
INSERT INTO courses (code, title, credit_hours) VALUES
  ('CEN201', 'Database Systems', 4),
  ('GEN101', 'Entrepreneurship', 2);
""")

CEN = "(SELECT id FROM departments    WHERE code = 'CEN')"
MED = "(SELECT id FROM departments    WHERE code = 'MED')"
SWE = "(SELECT id FROM specialisations WHERE code = 'SWE')"
NUR = "(SELECT id FROM specialisations WHERE code = 'NUR')"
GRA = "(SELECT id FROM campuses       WHERE code = 'GRA')"
YR1 = "(SELECT id FROM academic_years WHERE label = '2026/27')"
YR2 = "(SELECT id FROM academic_years WHERE label = '2027/28')"
TERM1 = f"(SELECT id FROM terms WHERE academic_year_id = {YR1})"
TERM2 = f"(SELECT id FROM terms WHERE academic_year_id = {YR2})"


def cls(dept, spec, level, year=YR1):
    return ("INSERT INTO classes (campus_id, department_id, specialisation_id, "
            f"level, academic_year_id) VALUES ({GRA}, {dept}, {spec or 'NULL'}, "
            f"{level}, {year});")


print("\nRULE 2 - LEVEL 1 IS DEPARTMENT-WIDE")
allowed("level 1 class with no specialisation",       "classes", cls(CEN, None, 1))
rejected("level 1 class that names a specialisation", "classes", cls(CEN, SWE, 1))
rejected("the same level 1 class created twice",      "classes", cls(CEN, None, 1))
rejected("level 2 class with no specialisation",      "classes", cls(CEN, None, 2))
allowed("level 2 software engineering class",         "classes", cls(CEN, SWE, 2))
rejected("the same level 2 class created twice",      "classes", cls(CEN, SWE, 2))
rejected("nursing filed under computer engineering",  "classes", cls(CEN, NUR, 2))

print("\nTHE SAME RULE, APPLIED TO CURRICULUM AND FEES")
rejected("a level 1 subject aimed at a specialisation", "curriculum_entries",
         f"INSERT INTO curriculum_entries (department_id, specialisation_id, level, course_id) "
         f"VALUES ({CEN}, {SWE}, 1, (SELECT id FROM courses WHERE code = 'CEN201'));")
allowed("a level 1 subject for the whole department", "curriculum_entries",
        f"INSERT INTO curriculum_entries (department_id, level, course_id) "
        f"VALUES ({CEN}, 1, (SELECT id FROM courses WHERE code = 'GEN101'));")
rejected("a level 1 fee aimed at a specialisation", "fee_schedules",
         f"INSERT INTO fee_schedules (academic_year_id, department_id, specialisation_id, "
         f"level, tuition_total) VALUES ({YR1}, {CEN}, {SWE}, 1, 450000);")
allowed("a level 1 fee for the whole department", "fee_schedules",
        f"INSERT INTO fee_schedules (academic_year_id, department_id, level, tuition_total) "
        f"VALUES ({YR1}, {CEN}, 1, 450000);")

print("\nRULE 1 - A PERSON IS NOT A ROLE")
allowed("a person with a normalised phone number", "persons",
        "INSERT INTO persons (surname, given_names, name_on_id, date_of_birth, phone) "
        "VALUES ('NGO', 'Marie Claire', 'NGO Marie Claire', '2006-03-14', '+237677487127');")
rejected("a person with an unnormalised phone number", "persons",
         "INSERT INTO persons (surname, given_names, name_on_id, phone) "
         "VALUES ('ACHU', 'Vivian', 'ACHU Vivian', '677 487 127');")
allowed("a second person, to be hired as a lecturer", "persons",
        "INSERT INTO persons (surname, given_names, name_on_id, phone) "
        "VALUES ('TANYI', 'Bertrand', 'TANYI Bertrand', '+237690779552');")

MARIE = "(SELECT id FROM persons WHERE surname = 'NGO')"
BERT = "(SELECT id FROM persons WHERE surname = 'TANYI')"

allowed("that person becoming a student, with a guardian", "students",
        f"INSERT INTO students (person_id, guardian_name, guardian_phone) "
        f"VALUES ({MARIE}, 'NGO Paul', '+237675413814');")
rejected("a student with no guardian", "students",
         f"INSERT INTO students (person_id) VALUES ({BERT});")
allowed("the other person becoming a lecturer", "staff",
        f"INSERT INTO staff (person_id, job_title) VALUES ({BERT}, 'Lecturer');")
allowed("the SAME human being both student and staff", "staff",
        f"INSERT INTO staff (person_id, job_title) VALUES ({MARIE}, 'Lab assistant');")

print("\nENROLMENT")
L1 = f"(SELECT id FROM classes WHERE level = 1)"
L2 = f"(SELECT id FROM classes WHERE level = 2)"
allowed("enrolling her at level 1, studying online", "enrolments",
        f"INSERT INTO enrolments (student_id, class_id, delivery_mode) "
        f"VALUES ({MARIE}, {L1}, 'online');")
rejected("a second active enrolment for the same student", "enrolments",
         f"INSERT INTO enrolments (student_id, class_id) VALUES ({MARIE}, {L2});")

print("\nCOURSES, TERMS AND LECTURERS")
allowed("a subject taught to the level 1 class this term", "course_offerings",
        f"INSERT INTO course_offerings (class_id, course_id, term_id, academic_year_id) "
        f"VALUES ({L1}, (SELECT id FROM courses WHERE code = 'GEN101'), {TERM1}, {YR1});")
rejected("a term from a different academic year", "course_offerings",
         f"INSERT INTO course_offerings (class_id, course_id, term_id, academic_year_id) "
         f"VALUES ({L1}, (SELECT id FROM courses WHERE code = 'CEN201'), {TERM2}, {YR1});")

OFFER = "(SELECT id FROM course_offerings LIMIT 1)"
allowed("a lead lecturer for that subject", "teaching_assignments",
        f"INSERT INTO teaching_assignments (course_offering_id, staff_id, role) "
        f"VALUES ({OFFER}, {BERT}, 'lead');")
rejected("a second lead lecturer for the same subject", "teaching_assignments",
         f"INSERT INTO teaching_assignments (course_offering_id, staff_id, role) "
         f"VALUES ({OFFER}, {MARIE}, 'lead');")
allowed("an assistant alongside the lead", "teaching_assignments",
        f"INSERT INTO teaching_assignments (course_offering_id, staff_id, role) "
        f"VALUES ({OFFER}, {MARIE}, 'assistant');")

print("\nMONEY")
ENROL = f"(SELECT id FROM enrolments WHERE student_id = {MARIE})"
allowed("charging her the first installment", "student_charges",
        f"INSERT INTO student_charges (enrolment_id, sequence, label, amount_due, due_on) "
        f"VALUES ({ENROL}, 1, 'First installment', 150000, '2026-10-15');")
allowed("a mobile money payment, student bearing the fee", "payments",
        f"INSERT INTO payments (student_id, enrolment_id, method, amount_charged, "
        f"provider_fee, amount_received, provider_reference) "
        f"VALUES ({MARIE}, {ENROL}, 'mtn_momo', 151500, 1500, 150000, 'MP26100001');")
rejected("a payment whose three figures do not add up", "payments",
         f"INSERT INTO payments (student_id, method, amount_charged, provider_fee, "
         f"amount_received, provider_reference) "
         f"VALUES ({MARIE}, 'mtn_momo', 151500, 1500, 149000, 'MP26100002');")
rejected("the same provider reference banked twice", "payments",
         f"INSERT INTO payments (student_id, method, amount_charged, provider_fee, "
         f"amount_received, provider_reference) "
         f"VALUES ({MARIE}, 'mtn_momo', 151500, 1500, 150000, 'MP26100001');")
allowed("allocating that payment to the installment", "payment_allocations",
        f"INSERT INTO payment_allocations (payment_id, student_charge_id, amount) "
        f"VALUES ((SELECT id FROM payments WHERE provider_reference = 'MP26100001'), "
        f"        (SELECT id FROM student_charges WHERE sequence = 1), 150000);")

print("\nADMISSIONS FUNNEL")
rejected("accepting a candidate with no person record", "admissions",
         f"INSERT INTO admissions (stage, campus_id, department_id, level_applied, "
         f"academic_year_id, surname, given_names, phone) "
         f"VALUES ('accepted', {GRA}, {CEN}, 1, {YR1}, 'MBOM', 'Eric', '+237655596057');")
allowed("a lead who has only asked a question", "admissions",
        f"INSERT INTO admissions (campus_id, department_id, level_applied, "
        f"academic_year_id, surname, given_names, phone, source) "
        f"VALUES ({GRA}, {CEN}, 1, {YR1}, 'MBOM', 'Eric', '+237655596057', 'whatsapp');")
rejected("applying to level 2 without naming a specialisation", "admissions",
         f"INSERT INTO admissions (campus_id, department_id, level_applied, "
         f"academic_year_id, surname, given_names, phone) "
         f"VALUES ({GRA}, {CEN}, 2, {YR1}, 'BIH', 'Clarisse', '+237656894203');")

print("\nSINGLETONS")
rejected("a second main campus", "campuses",
         "INSERT INTO campuses (code, name, region, is_main) "
         "VALUES ('MRA', 'Maroua', 'Far North Region', true);")
allowed("the first head of computer engineering", "staff_departments",
        f"INSERT INTO staff_departments (staff_id, department_id, is_head) "
        f"VALUES ({BERT}, {CEN}, true);")
rejected("a second head of the same department", "staff_departments",
         f"INSERT INTO staff_departments (staff_id, department_id, is_head) "
         f"VALUES ({MARIE}, {CEN}, true);")

print("\nWHAT THE VIEWS SHOW")
for view in ("current_students", "fee_status", "teaching_load",
             "admissions_funnel", "students_missing_required_data",
             "fee_schedules_unbalanced", "fee_arrears",
             "online_students_for_exams", "level_one_specialisation_interest"):
    out = db.psql(f"SELECT count(*) FROM {view};")
    if re.search(r"\d+", out or ""):
        passed += 1
        print(f"  PASS  {view} runs")
    else:
        failed += 1
        print(f"  FAIL  {view} does not run")

print()
print(db.psql("SELECT surname, department, specialisation, level, award, "
              "delivery_mode FROM current_students;"))
print(db.psql("SELECT surname, total_charged, total_paid, balance, status "
              "FROM fee_status;"))
print(db.psql("SELECT surname, course_code, role, term FROM teaching_load;"))

print(f"{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
