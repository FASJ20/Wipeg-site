"""Prove the schema's rules hold, against a real PostgreSQL.

Run it after any change to schema.sql:

    python -m pip install pgserver
    python db/test_rules.py

It starts a throwaway PostgreSQL, applies db/schema.sql to it and checks that
each rule the school asked for is actually enforced by the database — Level 1
being department-wide, specialisations belonging to their own department,
guardians being required, and so on.

psql() prints errors to stderr and returns '' rather than raising, so each
test checks the EFFECT: did the row actually appear or not?
"""
import pgserver, pathlib, tempfile, re, sys, io, contextlib

db = pgserver.get_server(tempfile.mkdtemp(prefix="wipegtest"))
SCHEMA = pathlib.Path(__file__).with_name("schema.sql")
db.psql(SCHEMA.read_text(encoding="utf-8"))

passed = failed = 0

def count(table):
    out = db.psql(f"SELECT count(*) FROM {table};")
    return int(re.search(r"\d+", out).group())

def run_quietly(sql):
    """Swallow the expected psql error noise so the report stays readable."""
    err = io.StringIO()
    with contextlib.redirect_stderr(err):
        db.psql(sql)

def check(label, table, sql, expect_insert):
    global passed, failed
    before = count(table)
    run_quietly(sql)
    after = count(table)
    inserted = after > before
    ok = inserted == expect_insert
    if ok:
        passed += 1
        print(f"  PASS  {label}")
    else:
        failed += 1
        verb = "was rejected but should have worked" if expect_insert \
               else "was ALLOWED but should have been rejected"
        print(f"  FAIL  {label}  —  {verb}")

allowed  = lambda l, t, s: check(l, t, s, True)
rejected = lambda l, t, s: check(l, t, s, False)

# --- seed ------------------------------------------------------------------
db.psql("""
INSERT INTO campuses (code, name, region, is_main)
  VALUES ('GRA', 'Garoua', 'North Region', true);
INSERT INTO departments (slug, code, name) VALUES
  ('computer-engineering', 'CEN', 'Computer Engineering'),
  ('medical-biomedical-sciences', 'MED', 'Medical & Biomedical Sciences');
INSERT INTO programmes (department_id, code, name)
  SELECT id, 'SWE', 'Software Engineering' FROM departments WHERE code='CEN';
INSERT INTO programmes (department_id, code, name)
  SELECT id, 'NUR', 'Nursing' FROM departments WHERE code='MED';
INSERT INTO academic_years (label, starts_on, ends_on, is_current)
  VALUES ('2026/27', '2026-10-01', '2027-07-31', true);
""")

CEN = "(SELECT id FROM departments WHERE code='CEN')"
SWE = "(SELECT id FROM programmes  WHERE code='SWE')"
NUR = "(SELECT id FROM programmes  WHERE code='NUR')"
GRA = "(SELECT id FROM campuses    WHERE code='GRA')"
YR  = "(SELECT id FROM academic_years WHERE label='2026/27')"

def cls(dept, prog, level):
    p = prog if prog else "NULL"
    return (f"INSERT INTO classes (campus_id, department_id, programme_id, level, "
            f"academic_year_id) VALUES ({GRA}, {dept}, {p}, {level}, {YR});")

print("\nLEVEL 1 IS DEPARTMENT-WIDE")
allowed ("Level 1 class with no specialisation",      "classes", cls(CEN, None, 1))
rejected("Level 1 class that names a specialisation", "classes", cls(CEN, SWE, 1))
rejected("the same Level 1 class created twice",      "classes", cls(CEN, None, 1))

print("\nLEVEL 2 AND ABOVE NEEDS A SPECIALISATION")
rejected("Level 2 class with no specialisation",      "classes", cls(CEN, None, 2))
allowed ("Level 2 Software Engineering class",        "classes", cls(CEN, SWE, 2))
rejected("the same Level 2 class created twice",      "classes", cls(CEN, SWE, 2))
rejected("Nursing filed under Computer Engineering",  "classes", cls(CEN, NUR, 2))

print("\nSTUDENTS")
allowed("a student with a guardian", "students",
    "INSERT INTO students (surname, given_names, name_on_id, date_of_birth, "
    "phone, guardian_name, guardian_phone) VALUES "
    "('NGO', 'Marie Claire', 'NGO Marie Claire', '2006-03-14', "
    "'+237677487127', 'NGO Paul', '+237675413814');")

rejected("a student with no guardian", "students",
    "INSERT INTO students (surname, given_names, name_on_id, date_of_birth, phone) "
    "VALUES ('TANYI', 'Bertrand', 'TANYI Bertrand', '2004-01-09', '+237690779552');")

rejected("an unnormalised phone number", "students",
    "INSERT INTO students (surname, given_names, name_on_id, date_of_birth, "
    "phone, guardian_name, guardian_phone) VALUES "
    "('ACHU', 'Vivian', 'ACHU Vivian', '2005-05-05', "
    "'677 487 127', 'ACHU Rose', '+237675413814');")

print("\nENROLMENTS")
allowed("enrolling her in Level 1, studying online", "enrolments",
    f"INSERT INTO enrolments (student_id, class_id, delivery_mode) VALUES "
    f"((SELECT id FROM students WHERE surname='NGO'), "
    f" (SELECT id FROM classes WHERE level=1), 'online');")

rejected("a second active enrolment for the same student", "enrolments",
    f"INSERT INTO enrolments (student_id, class_id) VALUES "
    f"((SELECT id FROM students WHERE surname='NGO'), "
    f" (SELECT id FROM classes WHERE level=2));")

print("\nWHAT THE VIEWS SHOW")
print(db.psql("SELECT surname, department, programme, level, award, age, "
              "delivery_mode FROM current_students;"))

print(f"{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
