# WIPEG academic records — database design

**Status:** designed, written and tested. **Not deployed.** Nothing exists yet
but three files: `db/schema.sql` (25 tables, 9 views), `db/rollback.sql`, and
`db/test_rules.py`, which starts a real throwaway PostgreSQL, applies the
schema and tries to break every rule the design claims to enforce. It currently
passes 45 of 45.

**Scope:** students, lecturers, departments, courses, awards, fees, admissions,
campuses, levels, classes and academic years. Payment *processing* (the MTN and
Orange integrations) is not here — only the records those integrations will
write into. Google Workspace provisioning is not here either, but the two
columns it will need are, and they are marked.

---

## 1. What you asked for, and what each item became

You listed eleven things and said they must not each become a table of their
own. That was the right instinct. Three of them are not entities at all, and
saying so is most of the design work:

| You said | It became | Why |
|---|---|---|
| Students | `persons` + `students` | A student is a human *in a role*. Split, so a graduate you later hire is one human, not two records. |
| Teachers / Lecturers | `persons` + `staff` + `teaching_assignments` | Same split. Who they are, that they work here, and what they teach are three different lifespans. |
| Department | `departments` | A reference list. |
| Courses | `courses` + `curriculum_entries` + `course_offerings` | The subject, who studies it, and one actual delivery of it are three things. See §4.4. |
| Programs (HND, Degree, Masters) | `awards`, reached through `levels` | **Not a table of its own.** The award is a property of the level: Levels 1–2 are HND, 3 is Bachelor, 4–5 is Master. Stored once, in `levels.award_id`. |
| Fees status | **a view, `fee_status`** | **Not stored at all.** See §5.1. This is the single most important decision in the file. |
| Potential leads | `admissions`, one row with a `stage` | **Not a separate table from applications.** A lead, an applicant and an accepted candidate are one person at three moments. See §5.2. |
| Campus | `campuses` | A reference list. |
| Levels | `levels` | A reference list, 1–5, each carrying its award. |
| Classes | `classes` | A cohort: campus × department-or-specialisation × level × year. |
| Academic years | `academic_years` + `terms` | Course offerings and (later) results hang off a semester, not a whole year. |

### A vocabulary problem worth settling now

The word **programme** means two different things in the material I was given,
and the confusion was making the old schema wrong:

- On the flier and in `src/data/site.ts`, a department's **"courses"** are
  things like *Software Engineering* and *Nursing*. Those are not courses.
  Those are **specialisations** — what a student narrows into at Level 2.
- What you call **Programs** — HND, Degree, Masters — is the **award**: the
  certificate at the end.
- A **course** in this database is a taught subject: *Database Systems*,
  *Anatomy and Physiology*. Nobody has given me a list of these yet.

So the old `programmes` table has been renamed `specialisations`, `awards` is
new, and `courses` now means what it says. The website still uses the word
"courses" for specialisations on its public pages, which is fine — that is
marketing copy and it reads naturally. But the database will not use one word
for two things.

---

## 2. The three rules the whole design turns on

**1. A person is not a role.** `persons` holds a human being — name, phone,
date of birth, photo. `students` and `staff` say what that human is to WIPEG.
Both use the person's own id as their primary key, so there is no second
identity to keep in step. The test suite proves the same human can hold both
rows at once.

**2. Level 1 is department-wide; students split at Level 2.** This rule now
appears in four places — `classes`, `curriculum_entries`, `fee_schedules` and
`admissions` — and in every one of them it is the identical pattern: a nullable
`specialisation_id` plus a `CHECK` that makes it null at Level 1 and required
above it. Learn the pattern once and you can read all four.

**3. A status that can be calculated is never stored.** There is no
`fee_status` column, no `is_paid` flag, no `balance` column. There is a view
that computes it. A stored status is correct the day you write it and wrong the
next.

---

## 3. The shape of it

Five layers. A table may only depend on the layers above it.

```
1  CATALOGUE   campuses, departments, awards, levels, specialisations,
               courses, curriculum_entries
               — what WIPEG offers. Edited once a year, by hand.

2  CALENDAR    academic_years, terms
               — when. Edited once a year, by hand.

3  PEOPLE      persons, students, staff, staff_departments, documents
               — one row per human, for life.

4  DELIVERY    classes, course_offerings, teaching_assignments, enrolments,
               admissions, admission_contacts
               — who is taught what. Changes constantly.

5  MONEY       fee_schedules, fee_schedule_installments, student_charges,
               payments, payment_allocations
               — append-only. Never edited after the fact.
```

Nothing in the catalogue knows a student exists. That is what makes it safe to
restructure departments in August without touching a single student record.

---

## 4. Walking through it

### 4.1 Catalogue

`campuses` has a partial unique index enforcing **exactly one main campus** —
Garoua. It is a one-line guard against the confusion we already had once.

`awards` → `levels` is the "Programs" answer. Three award rows, five level
rows, each level pointing at its award. Both are seeded in `schema.sql` because
they are facts, not data entry. If a department ever runs Levels 1–2 as
something other than HND, this becomes level × department and the seed changes;
nothing else does.

`specialisations` carries `UNIQUE (id, department_id)`, which looks redundant —
`id` is already the primary key. It exists so that four other tables can carry
a **composite foreign key** `(specialisation_id, department_id)` and have
PostgreSQL itself refuse to file a Nursing class under Computer Engineering.
That mistake is now impossible rather than merely discouraged.

### 4.2 Calendar

`terms` are semesters. `academic_years` and `terms` both carry a redundant-
looking `UNIQUE (id, academic_year_id)` for the same composite-key reason: it
lets `course_offerings` prove that the class and the term it names belong to the
**same academic year**. Without it you could timetable a 2026/27 class into a
2027/28 semester, and nobody would notice until timetables came out. The test
suite checks this.

How many terms a WIPEG year has — two semesters or three — I have assumed two
but not hard-coded; `term_no` allows up to 3. **Needs confirming.**

### 4.3 People

`persons.phone` is deliberately **not unique**. Two siblings legitimately give
their mother's handset. It is indexed, and normalised to `+237…` by a `CHECK`
so the same person cannot be entered twice as "677 487 127" and "+237677487127".

`students.matricule` is unique but nullable — issued on paper by the
administration, so it is stored and never generated. **There is still no
`CHECK` on its format** because I will not invent one while a real one exists.

`documents` hangs off `persons`, not `students`, so a lecturer's degree
certificate is filed exactly like a student's birth certificate — one table,
one storage convention, one verification workflow.

### 4.4 Courses: three tables, not one

This is the part most school databases get wrong, so it is worth being explicit.

- **`courses`** is a catalogue entry. *CEN201 — Database Systems, 4 credits.*
  It belongs to no department, because general subjects like English and
  Entrepreneurship are taught across all of them.
- **`curriculum_entries`** places a course: *"Level 2 Software Engineering
  students take CEN201 in term 1."* A null specialisation means the whole
  department at that level, which covers both Level 1 and shared Level 2
  subjects. This is a many-to-many join, so one course can appear in six
  specialisations without being duplicated.
- **`course_offerings`** is one actual delivery: *this class, this course, this
  term.* This is the row that becomes a Google Classroom, because it is the
  only one with exactly one roster and one set of teachers.

**`teaching_assignments`** then joins staff to offerings many-to-many, because
co-teaching and lab assistants are normal and a `lecturer_id` column on the
offering could not express them. A partial unique index allows exactly one
`lead` per offering and unlimited assistants.

### 4.5 Enrolments

Unchanged in spirit from the version you already approved: one row per student
per year, carrying `delivery_mode` so the exam-travel list is one query. A
student's choice of specialisation is not stored as a field anywhere — it is
recorded by *which class they joined at Level 2*, so it cannot drift out of step
with where they actually sit.

---

## 5. The three decisions I'd defend hardest

### 5.1 Fees status is a view, not a column

You listed "Fees status" as data to store. It is the one item I pushed back on.

Storing `fee_status = 'paid'` means that the moment a payment arrives, a
deadline passes, or a waiver is granted, the column is a lie until somebody
remembers to update it. Worse, when it disagrees with the payment records, no
one can tell which is right.

So the money layer stores only **facts that happened**:

| Table | Fact |
|---|---|
| `fee_schedules` | what a group is charged this year |
| `fee_schedule_installments` | the three installments and their due dates |
| `student_charges` | what *this* student owes, **copied at enrolment** |
| `payments` | money that actually moved |
| `payment_allocations` | which installment each payment settled |

and `fee_status` computes balance, next due date and a label
(`paid` / `on_track` / `due_soon` / `overdue`) on every read. `fee_arrears`
filters it to who needs chasing, and carries their phone number so the admin
page can build a WhatsApp link without a second query.

Three details inside that worth naming:

**Charges are a snapshot, not a lookup.** When a student enrols, the
installments are *copied* from the schedule into `student_charges`. If fees rise
next August, last year's students keep the figures they agreed to. A live lookup
would silently rewrite history.

**Payments record three figures, not one.** With Mobile Money, what leaves the
student's wallet, what MTN keeps, and what reaches WIPEG are three different
numbers. Since you decided the student bears the fee, a `CHECK` enforces
`amount_charged = amount_received + provider_fee`, and only `amount_received`
reduces a balance. Conflating these is how school books stop balancing.

**`provider_reference` is unique.** That one word is what will make the payment
webhook safe to retry — the same notification arriving twice cannot be banked
twice. It matters more than it looks.

Payments are also **append-only**. A mistake is corrected by a reversing row,
never by editing the original. There is no `updated_at` on that table on purpose.

### 5.2 Leads and applications are one table

A curious visitor who messages on WhatsApp, an applicant, and an accepted
candidate are the same person pursuing the same thing at three moments. Two
tables would mean copying ten fields across and letting them drift.

So `admissions` is one row that advances through
`lead → applied → reviewing → offered → accepted → enrolled`, with
`rejected`, `withdrawn` and `lost` as exits. `person_id` stays null until
acceptance — that is the exact moment a stranger becomes somebody WIPEG holds a
file on, and a `CHECK` makes it impossible to reach `accepted` without one.

`admission_contacts` logs every follow-up, because without it the registry
cannot tell a cold lead from one nobody has called yet. `admissions_funnel`
surfaces a `never_contacted` count per stage.

The one thing this costs: the row is no longer a frozen record of what was
submitted. The convention is that corrections happen on the `persons` row after
acceptance and the admission row is left alone. That is currently convention,
not enforcement — see §8.

### 5.3 One `persons` table instead of separate students and lecturers

The alternative was a `students` table and a `lecturers` table, each with its
own name, phone, email and date-of-birth columns. I rejected it because:

- Retaining a good HND graduate as a lab assistant is normal here. Under two
  tables they become two records with two phone numbers that drift apart.
- The phone-normalisation rule, the email-case rule and the Workspace account
  mapping would each have to exist twice, and would eventually disagree.

The cost is real and worth stating: **every student query now needs a join.**
That is paid for by the views — `current_students` and `teaching_load` are
already written, so day-to-day queries are still one-liners.

---

## 6. Where I deliberately did *not* normalise

Two places, both on purpose. The design skills' checklist asks that any
denormalisation be justified, so:

**Guardian details stay on `students`.** The textbook move is a `guardians`
table plus a junction, so siblings share one guardian record. I kept
`guardian_name` and `guardian_phone` as `NOT NULL` columns instead, because you
said explicitly that every student must have one — especially minors. A junction
table cannot express "at least one" in SQL without a trigger, so normalising
here would have traded a **guarantee you asked for** for a convenience nobody
asked for. If sibling-linking ever matters, this promotes cleanly.

**`course_offerings.academic_year_id` is redundant.** It can be derived from the
class. It is stored anyway so the two composite foreign keys can prove that the
class and the term share a year. Redundancy in the service of a constraint is
not the same as redundancy by accident, and the column is marked "never edited
by hand".

---

## 7. Integrity, indexing and deletion

**Every foreign key is indexed.** Not for elegance: without them, "show me
everyone in this class" and "show me this lecturer's timetable" both become
sequential scans, and Supabase's free tier will feel it first.

**Partial unique indexes, not plain UNIQUE, wherever a nullable column is part
of the key.** PostgreSQL treats nulls as distinct, so `UNIQUE (campus,
department, specialisation, level, year)` would happily allow the same Level 1
class to be created over and over. There are two indexes instead of one in four
places for exactly this reason, and the test suite checks all four.

**Deletion policy: `RESTRICT` everywhere, `CASCADE` only where the child is
meaningless alone.** Nothing that constitutes an academic record can be removed
by a cascade — you cannot delete a department that still has classes, or a
student who has enrolments. `CASCADE` appears in five places only:
`students`/`staff` off `persons`, `fee_schedule_installments` off their
schedule, `payment_allocations` off their payment, `teaching_assignments` off
their offering, and `admission_contacts` off their admission.

**People are never deleted.** `students.status` moves to `graduated`,
`withdrawn` or `deceased`. A 2027 leaver still needs a transcript in 2032.

**Money is `bigint` francs, not `DECIMAL`.** Both design skills say "DECIMAL for
money", and the reason behind that rule is exactness — floats lose cents. XAF
has no subunit; there are no centimes. A whole-franc integer is already exact,
so it satisfies the rule's purpose without pretending to a precision the
currency does not have. `currency` is a column anyway, checked to `'XAF'`, so
the day WIPEG bills anything else the constraint fails loudly instead of
silently mixing units.

**Row-level security is on for all 25 tables with no policies**, which in
Supabase means the anon and publishable keys can read nothing at all. The
application reaches the database only server-side with the service role, which
bypasses RLS. If a key ever leaks into browser JavaScript, it opens nothing.
Policies get written when — and only when — students get direct logins.

---

## 8. What the database does *not* enforce

Being honest about the gaps matters more than claiming completeness.

| Rule | Why not enforced | How it is caught instead |
|---|---|---|
| Installments must sum to the tuition total | SQL cannot check a sum across rows declaratively | `fee_schedules_unbalanced` view — should always be empty |
| A student must have a date of birth and a photo | Those columns live on `persons`, shared with staff; `NOT NULL` would bind lecturers too | `students_missing_required_data` view |
| An admission row should freeze once accepted | Would need a trigger | Convention, plus `decided_at` / `decided_by` |
| Allocations must not exceed the payment | Cross-row sum again | Application-side check at allocation time |

Each of these could become a trigger. I have not written them, because a trigger
is code that runs on every write and I would rather add them once the real
workflows exist than guess now.

---

## 9. Audit against the two design skills

You pointed me at `database-design` and `database-schema-designer`. Both were
installed and their checklists applied. Current state:

| Check | Status |
|---|---|
| Every table has a primary key | Yes, 25/25 |
| All relationships have FK constraints | Yes |
| ON DELETE strategy defined per FK | Yes — §7 |
| Indexes on every foreign key | Yes |
| Appropriate data types, money not float | Yes — `bigint` XAF, justified §7 |
| `NOT NULL` on required fields | Yes |
| UNIQUE constraints where needed | Yes, incl. 8 partial unique indexes |
| CHECK constraints for validation | 40+, incl. all four Level 1 rules |
| `created_at` / `updated_at` | Yes, with a trigger; omitted on append-only tables on purpose |
| Migrations reversible | Yes — `rollback.sql`, tested apply → rollback → replay |
| 1NF — atomic values, no repeating groups | Yes; installments are rows, not `amount_1/2/3` columns |
| 2NF — no partial dependencies | Yes |
| 3NF — no transitive dependencies | Yes; award moved out of `levels` into `awards` precisely for this |
| Denormalisation documented | Yes — §6 |
| ERD produced | Yes, plus this document |
| Tested | 45 assertions against a real PostgreSQL |

Two checklist items are **not** met yet, and cannot be until the database is
deployed: "tested on staging with production data", and "separate read-only and
read-write accounts".

---

## 10. Still needed from the administrator

Nothing below blocks deployment; all of it blocks *seeding real data*.

1. **Matricule format** — so a `CHECK` can be added.
2. **Specialisation codes** — short codes for the ~51 specialisations on the flier.
3. **The actual course list** — subject codes, titles, credit hours, and which
   specialisation and level each belongs to. This is the biggest gap: the
   `courses` catalogue is empty and I will not invent it.
4. **Fee structure** — total per specialisation per level, and the three
   installment amounts and due dates. You said this is coming.
5. **How many semesters** in a WIPEG academic year.
6. **Staff list** — names, phones, qualifications, departments.
7. Confirmation that **Levels 1–2 = HND, 3 = Bachelor, 4–5 = Master** holds for
   every department.

---

## 11. Deploying it

```bash
psql "$DATABASE_URL" -f db/schema.sql     # apply
psql "$DATABASE_URL" -f db/rollback.sql   # undo, completely
python db/test_rules.py                   # prove the rules still hold
```

`DATABASE_URL` is a secret. It belongs in Vercel's environment variables and
never in this repository.

**Migration policy from here:** `schema.sql` is the baseline and stays editable
only while nothing real is in the database. The moment WIPEG has one live
student record, changes stop being edits to this file and become numbered
migrations in `db/migrations/`, each with its own up and down — because from
that point, `rollback.sql` means "delete the school's records".

---

## 12. What this sets up

The two columns the Google Workspace integration will use are already in place
and deliberately at different levels:

- `classes.google_group_email` — a Google **Group** per cohort, for
  announcements and timetables.
- `course_offerings.google_course_id` — a Google **Classroom** per subject,
  which is the right granularity, because a Classroom has one roster and one
  teacher and so does an offering.

Both are nullable, and null means "not created yet" — a normal state, not an
error. That nullability is what lets provisioning be a background job that
retries, rather than something that must succeed during registration.

That is the bridge to the next conversation: the backend, and how it talks to
Workspace.
