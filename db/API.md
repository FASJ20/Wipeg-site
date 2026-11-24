# WIPEG backend — endpoints and who may call them

**Status:** designed, not built. Nothing under `src/app/api/` exists yet. This
document is the contract the routes will be written against, and it is complete
enough to build from in the order given in §13.

**Companion documents:** `db/DESIGN.md` is the reasoning behind the 25 tables
and 10 views; `db/schema.sql` is the schema itself. Every endpoint below names
the tables it touches, so the two can be read side by side.

---

## 1. What changed first: payment came out

You asked for payment to be removed from the architecture, and said that this
does not mean fee data stops being collected. Those are two different things,
and the schema now separates them properly.

**Removed.** `payments` and `payment_allocations` are gone. With them went the
three-figure money model (`amount_charged` / `provider_fee` /
`amount_received`), the `pending → succeeded → failed` status machine, the
unique `provider_reference` that made a gateway webhook safe to retry, and the
`payment_allocations` table that said which installment each transfer settled.
All of that existed to serve money arriving *through* the system.

**Kept, and still doing the real work.** `fee_schedules` (what a group is
charged this year), `fee_schedule_installments` (the three instalments and their
due dates), `student_charges` (what *this* student owes, snapshotted at
enrolment so a fee rise cannot rewrite history), and the `fee_status` view that
computes balance, next due date and a `paid` / `on_track` / `due_soon` /
`overdue` label on every read.

**Added in their place.** One table, `fee_receipts`: money WIPEG has already
received, entered after the fact by the bursar.

```
fee_receipts
  enrolment_id     whose fees this settles
  receipt_no       the number on the paper receipt or bank slip — UNIQUE
  amount           one figure, because only one figure can be verified
  method           cash | bank_deposit | mtn_momo | orange_money | cheque | other
  bank_reference   the deposit slip or MoMo transaction id, for reconciling
  received_on      the date on the receipt, not the date it was typed
  reverses_id      set only on a correcting row — UNIQUE, so nothing reverses twice
  recorded_by      which member of staff keyed it in
```

Three consequences worth stating plainly, because they are what "payment
removed" actually buys you:

1. **There is no gateway, no webhook, no callback URL and no merchant
   account.** Nothing in this system can take money, so nothing in it can lose
   money or be made to move money by someone who finds a URL. `method` is a
   note about where cash landed, not an integration.
2. **No card or account numbers are stored anywhere.** Not as a policy that
   could be forgotten — there is no column to put them in.
3. **A receipt is append-only.** Keyed in wrongly, it is cancelled by a second
   row carrying the negative amount and pointing at the mistake. A balance stays
   a plain `sum(amount)`, and the error is still legible a year later.

**Also added:** `staff_roles`, because you asked who has access to what and the
database had no way to answer. See §4.

The rule tests were rewritten to match and now cover receipt reversal and role
grants: **55 assertions, 55 passing**, against a real throwaway PostgreSQL.
`db/schema.sql` → `db/rollback.sql` → `db/schema.sql` round-trips cleanly
(35 relations → 0 → 35).

---

## 2. The shape of the backend

```
   browser / phone
         │  HTTPS, session cookie
         ▼
   Next.js route handlers        src/app/api/**/route.ts        on Vercel
         │  ├── resolve session  → who is calling
         │  ├── authorise        → may they call this?
         │  ├── validate         → zod schema per endpoint
         │  └── one DB call or one transaction
         ▼
   Supabase Postgres            service role key, server-side only
         │
         └── Supabase Storage   documents and photos, private bucket
```

Four decisions behind that picture:

**The browser never touches the database.** RLS is enabled on all 25 tables
with no policies, so the publishable key reads nothing. Every read and write
goes through a route handler holding the service role key, which exists only as
a Vercel environment variable. This is why there are so many endpoints: they
*are* the permission system.

**Route handlers, not a separate API server.** The site is already a Next.js
app on Vercel. A second service would mean a second deploy, a second set of
secrets and a CORS story, to serve one institute.

**No `/v1/` prefix.** There is exactly one client and it ships with the server.
Versioning is a cost you pay to support clients you cannot redeploy, and WIPEG
has none. If a public or mobile client ever appears, the routes in §6 become
`/api/v1/...` in one commit.

**snake_case in request and response bodies.** The same spelling as the
columns, end to end. A camelCase façade would mean a translation layer between
every handler and every query, maintained by hand, for cosmetics.

---

## 3. Identity: how a caller becomes a person

Google Workspace for Education is the only credential store. WIPEG issues
`@` school addresses; this system never holds a password and has no
"forgot password" flow to abuse.

```
1. GET /api/auth/google/start
      → redirect to Google, hosted domain pinned to GOOGLE_WORKSPACE_DOMAIN
2. Google authenticates the human
3. GET /api/auth/google/callback?code=…
      → exchange the code
      → read the verified email
      → SELECT id FROM persons WHERE lower(school_email) = lower($1)
         ├─ no row              → 403, and nothing is created
         └─ row → load roles    → signed session cookie, 12 hours
```

**A Google account alone grants nothing.** The email must already match
`persons.school_email`, which only the registrar or administrator can set. Sign-in
proves who you are; `persons`, `students`, `staff` and `staff_roles` decide
what that means. Someone who leaves WIPEG loses access when their Workspace
account is suspended *and* again when their `staff.status` becomes `former` —
two independent locks, deliberately.

**Applicants and leads do not sign in at all.** They have no Workspace account
and should not get one before they enrol. Instead the enquiry response carries a
signed, expiring token tied to that one `admissions` row:

```
token = HMAC-SHA256(admission_id + expires_at, ADMISSION_TOKEN_SECRET)
```

It is sent by WhatsApp or email, it expires in 30 days, and it opens exactly one
record. There is no endpoint that will look an applicant up by phone number —
see §10.

**The session cookie** is `httpOnly`, `secure`, `SameSite=Lax`, 12 hours, and
holds only `person_id` plus a signature. Roles are re-read from the database on
every request, so revoking a role takes effect on the next click rather than at
the next sign-in.

---

## 4. The ten kinds of caller

| Caller | How the system knows | What it is scoped to |
|---|---|---|
| **Public** | no session | the public catalogue and the enquiry form |
| **Applicant** | signed token on one `admissions` row | that one row |
| **Student** | sign-in matches a `students` row | their own record only |
| **Lecturer** | sign-in matches `staff`, and has `teaching_assignments` rows | the offerings they teach |
| **HoD** | `staff_departments.is_head = true` | their own department |
| **Registrar** | `staff_roles.role = 'registrar'` | all academic records |
| **Bursar** | `staff_roles.role = 'bursar'` | all fee records |
| **Admissions** | `staff_roles.role = 'admissions'` | the funnel |
| **Administrator** | `staff_roles.role = 'administrator'` | everything, and grants roles |
| **Service** | `X-Cron-Secret` header, no session | the four job endpoints only |

Four things to notice:

**Roles are additive, not a ladder.** The same lecturer can head a department
and hold the bursar role. The check is "does this caller hold any of the roles
this endpoint accepts", never "is this caller senior enough".

**Lecturer and HoD are not stored in `staff_roles`.** They are already facts:
teaching comes from `teaching_assignments`, headship from
`staff_departments.is_head`. Copying them into a roles table would create a
second answer that can disagree with the first.

**Administrator is omitted from every row in §6.** It can call everything
except the self-service routes under `/api/me/...`, which are scoped to the
caller's own record by definition — an administrator reads a student's fees
through `/api/fees/status`, not by impersonating them.

**Service is not a person.** Job endpoints take a shared secret from a Vercel
Cron header and reject anything carrying a session cookie, so a signed-in user
cannot trigger them by visiting the URL.

---

## 5. Authorisation: three rules and one helper

Role membership answers most questions. Three endpoint families need more,
because the question is not *what* you are but *whose* record it is.

**Rule 1 — own record only.** Everything under `/api/me/...` reads the
`person_id` from the session and ignores any id in the request. There is no
`/api/me?student_id=…`; the parameter does not exist, so it cannot be tampered
with.

**Rule 2 — department scoping.** A head of department may read and write within
their own department and nowhere else. The check is a join, not a column
comparison, because a specialisation belongs to a department and a class
belongs to both:

```sql
-- may this staff member act on this class?
SELECT EXISTS (
  SELECT 1
  FROM classes c
  JOIN staff_departments sd
    ON sd.department_id = c.department_id
  WHERE c.id = $1 AND sd.staff_id = $2 AND sd.is_head
);
```

**Rule 3 — assignment scoping.** A lecturer may read the roster of an offering
only if `teaching_assignments` says they teach it. Holding the `lecturer` job
title grants nothing on its own.

Every handler starts the same way, so the rules live in one place rather than
being remembered eighty times:

```ts
// src/server/auth.ts
const caller = await requireCaller(request);          // 401 if no valid session
requireRole(caller, ['registrar', 'administrator']);  // 403 if not held
await requireDepartment(caller, classId);             // 403 if out of scope
```

`requireCaller` returns `{ person_id, is_student, is_staff, roles[],
heads_departments[], teaches_offerings[] }` — one query, cached for the request.

---

## 6. The endpoint catalogue

89 routes. **Administrator may call all of them** except `/api/me/...`, and is
not repeated in the "Who" column.

### 6.1 Session and identity — 4

| Method | Path | What it does | Who |
|---|---|---|---|
| GET | `/api/auth/google/start` | Redirect to Google, domain pinned | Public |
| GET | `/api/auth/google/callback` | Exchange code, resolve person, set cookie | Public |
| POST | `/api/auth/signout` | Clear the session cookie | Any signed in |
| GET | `/api/me` | Who am I: person, roles, scope | Any signed in |

### 6.2 The public website — 5

| Method | Path | What it does | Who |
|---|---|---|---|
| GET | `/api/health` | Liveness, and whether the DB answers | Public |
| GET | `/api/catalogue` | Campuses, departments, specialisations, levels, awards. Cached 1 h | Public |
| POST | `/api/admissions/enquiries` | The enquiry form → `admissions` at stage `lead` | Public |
| GET | `/api/admissions/enquiries/{token}` | One applicant's own stage and outstanding documents | Applicant |
| POST | `/api/admissions/enquiries/{token}/documents` | Upload a results slip before enrolling | Applicant |

`POST /api/admissions/enquiries` is the only write a stranger can make. It is
rate limited to 5 per IP per hour and 3 per phone number per day, carries a
Cloudflare Turnstile token, and treats a repeat enquiry from the same phone in
the same academic year as an update to the existing row rather than a second
lead. Tables: `admissions`.

### 6.3 Student self-service — 6

All scoped to the signed-in student by Rule 1.

| Method | Path | What it does | Who |
|---|---|---|---|
| GET | `/api/me/enrolment` | Current class, level, specialisation, campus, mode | Student |
| GET | `/api/me/timetable` | This term's offerings for their class | Student |
| GET | `/api/me/courses` | Subjects this year, with lecturer names | Student |
| GET | `/api/me/fees` | Own `fee_status` row, charges and receipts | Student |
| GET | `/api/me/documents` | What is on file, what is missing | Student |
| POST | `/api/me/documents` | Upload a birth certificate, GCE slip, photo | Student |

### 6.4 Lecturers — 4

| Method | Path | What it does | Who |
|---|---|---|---|
| GET | `/api/me/teaching` | The offerings this lecturer is assigned to | Lecturer |
| GET | `/api/offerings/{id}` | One offering: course, class, term, colleagues | Assigned lecturer, HoD (own dept), Registrar |
| GET | `/api/offerings/{id}/students` | The roster | Assigned lecturer, HoD (own dept), Registrar |
| GET | `/api/offerings/{id}/roster.csv` | The same, as a file to mark from | Assigned lecturer, HoD (own dept), Registrar |

### 6.5 Students as records — 7

| Method | Path | What it does | Who |
|---|---|---|---|
| GET | `/api/students` | Search and list. Filters: campus, department, specialisation, level, year, status | Registrar, Bursar, HoD (own dept) |
| GET | `/api/students/{id}` | One student: person, enrolments, documents | Registrar, Bursar, HoD (own dept) |
| POST | `/api/students` | Create a person and a student row together | Registrar |
| PATCH | `/api/students/{id}` | Correct details, guardian, status | Registrar |
| PUT | `/api/students/{id}/matricule` | Record the number issued on paper | Registrar |
| GET | `/api/persons/{id}/documents` | Documents for a student or a lecturer | Registrar, the person themself |
| POST | `/api/persons/{id}/documents` | File a scan against a person | Registrar |

### 6.6 Staff and permissions — 6

| Method | Path | What it does | Who |
|---|---|---|---|
| GET | `/api/staff` | List, filterable by department and status | Registrar, HoD (own dept) |
| GET | `/api/staff/{id}` | One member of staff, with departments and load | Registrar, HoD (own dept) |
| POST | `/api/staff` | Create a person and a staff row, or add a staff row to an existing person | Administrator only |
| PATCH | `/api/staff/{id}` | Employment type, title, qualification, status | Administrator only |
| PUT | `/api/staff/{id}/departments` | Set departments and headship | Administrator only |
| POST | `/api/staff/{id}/roles` | Grant or revoke `registrar`/`bursar`/`admissions`/`administrator` | Administrator only |

The role endpoint is the sharpest one in the system: it is the only way to widen
anybody's access. It writes `granted_by` from the session, revokes by setting
`revoked_on` rather than deleting, and refuses to let a caller revoke their own
`administrator` role while they are the last one holding it. Tables:
`staff_roles`.

### 6.7 Admissions back office — 7

| Method | Path | What it does | Who |
|---|---|---|---|
| GET | `/api/admissions` | The work queue. Filters: stage, campus, department, year, never-contacted | Admissions, Registrar |
| GET | `/api/admissions/{id}` | One candidate with their full contact history | Admissions, Registrar |
| PATCH | `/api/admissions/{id}` | Move stage, set intended specialisation, add notes | Admissions |
| POST | `/api/admissions/{id}/contacts` | Log a WhatsApp message, a call, a visit | Admissions |
| POST | `/api/admissions/{id}/accept` | Turn a candidate into a person and a student | Admissions, Registrar |
| GET | `/api/admissions/funnel` | Counts by stage, campus and department | Admissions, Registrar, HoD (own dept) |
| GET | `/api/admissions/interest` | What Level 1 candidates say they want to specialise in next year | Admissions, Registrar |

### 6.8 Classes, offerings and teaching — 8

| Method | Path | What it does | Who |
|---|---|---|---|
| GET | `/api/classes` | List, filterable by campus, department, level, year | Any staff |
| POST | `/api/classes` | Create a cohort. Rejects a specialisation at Level 1 | Registrar |
| PATCH | `/api/classes/{id}` | Campus, capacity, Google group address | Registrar |
| GET | `/api/classes/{id}/students` | Who is in this cohort | Registrar, HoD (own dept), the class's lecturers |
| GET | `/api/offerings` | Subject-in-a-class-in-a-term, filterable | Any staff |
| POST | `/api/offerings` | Put a subject in front of a class this term | Registrar, HoD (own dept) |
| DELETE | `/api/offerings/{id}` | Only while nothing is attached to it | Registrar, HoD (own dept) |
| PUT | `/api/offerings/{id}/teachers` | Set the lead and assistants | Registrar, HoD (own dept) |

### 6.9 Enrolment — 4

| Method | Path | What it does | Who |
|---|---|---|---|
| POST | `/api/enrolments` | Enrol a student in a class **and** snapshot their charges | Registrar |
| GET | `/api/enrolments` | List, filterable by class, year, status | Registrar, Bursar |
| GET | `/api/enrolments/{id}` | One enrolment with charges and receipts | Registrar, Bursar, the student |
| PATCH | `/api/enrolments/{id}` | Status: completed, withdrawn, transferred | Registrar |

### 6.10 Fees — 12

| Method | Path | What it does | Who |
|---|---|---|---|
| GET | `/api/fees/schedules` | What each group is charged this year | Bursar, Registrar |
| POST | `/api/fees/schedules` | Set a year's fee for a department or specialisation and level | Bursar |
| PATCH | `/api/fees/schedules/{id}` | Change a total before anyone has enrolled against it | Bursar |
| PUT | `/api/fees/schedules/{id}/installments` | Replace the instalment set; rejected unless it sums to the total | Bursar |
| GET | `/api/enrolments/{id}/charges` | What this student owes, instalment by instalment | Bursar, Registrar, the student |
| POST | `/api/charges/{id}/waive` | Waive an instalment. Reason required | Bursar |
| GET | `/api/fees/status` | The `fee_status` view. Filters: class, department, level, status | Bursar, Registrar, HoD (own dept) |
| GET | `/api/fees/arrears` | Who to chase, worst first, with phone numbers | Bursar |
| POST | `/api/fees/receipts` | **Record money already received.** Takes no payment | Bursar |
| GET | `/api/fees/receipts` | The ledger. Filters: date range, method, student, enrolment | Bursar |
| POST | `/api/fees/receipts/{id}/reverse` | Cancel a mis-keyed receipt with a reversing row | Bursar |
| GET | `/api/fees/collections` | Totals by day and method, for the cash box and the bank | Bursar |

`POST /api/fees/receipts` is the busiest write in the system and the one most
worth getting right. It takes `enrolment_id`, `receipt_no`, `amount`, `method`,
`received_on`, and optionally `bank_reference` and `notes`. It sets
`recorded_by` from the session — never from the body. A duplicate `receipt_no`
comes back as `409 conflict` naming the receipt already on file, which is what
makes the form safe to submit twice on a bad connection. It returns the
recalculated `fee_status` row so the screen can show the new balance without a
second request.

`POST /api/fees/receipts/{id}/reverse` takes **only** a reason. The amount is
copied from the row being cancelled, so a reversal can never be for a different
figure than the mistake it corrects.

### 6.11 Catalogue and calendar — 12

Edited once a year, by two or three people. Writes are deliberately narrow.

| Method | Path | What it does | Who |
|---|---|---|---|
| GET | `/api/departments` | With specialisation counts and heads | Any staff |
| POST | `/api/departments` | Add a department | Administrator only |
| PATCH | `/api/departments/{id}` | Rename, reorder, deactivate | Administrator only |
| GET | `/api/specialisations` | Filterable by department | Any staff |
| POST | `/api/specialisations` | Add one under a department | Registrar |
| PATCH | `/api/specialisations/{id}` | Rename, set code, deactivate | Registrar |
| GET | `/api/courses` | The subject catalogue | Any staff |
| POST | `/api/courses` | Add a subject with code, title, credit hours | Registrar |
| PUT | `/api/curriculum` | Place subjects at a department, specialisation, level and term | Registrar |
| POST | `/api/academic-years` | Open next year, with its terms | Registrar |
| POST | `/api/academic-years/{id}/make-current` | Flip the current year. One only, enforced by index | Administrator only |
| GET | `/api/documents/{id}/download` | A 60-second signed Storage URL | Registrar, the person it belongs to |

### 6.12 Reports — 5

Each is a view already in the schema, so each is a one-line handler.

| Method | Path | View | Who |
|---|---|---|---|
| GET | `/api/reports/teaching-load` | `teaching_load` | HoD (own dept), Registrar |
| GET | `/api/reports/students-missing-data` | `students_missing_required_data` | Registrar |
| GET | `/api/reports/fee-schedules-unbalanced` | `fee_schedules_unbalanced` | Bursar |
| GET | `/api/reports/online-students` | `online_students_for_exams` | Registrar |
| GET | `/api/reports/current-students` | `current_students` | Registrar, HoD (own dept) |

`fee_schedules_unbalanced` and `students_missing_required_data` should both
always be empty. They are the two places the database admits it cannot enforce
something declaratively, so they are endpoints and not just views — the nightly
job in §6.14 reads them and complains.

### 6.13 Google Workspace provisioning — 5

Each writes to Google and records the result on the row, so they can be retried
without creating duplicates.

| Method | Path | What it does | Who |
|---|---|---|---|
| POST | `/api/google/students/{id}/account` | Create the school address, write it to `persons.school_email` | Registrar |
| POST | `/api/google/classes/{id}/group` | Create the cohort Group, write `classes.google_group_email` | Registrar |
| POST | `/api/google/offerings/{id}/classroom` | Create the Classroom course, write `course_offerings.google_course_id` | Registrar, HoD (own dept) |
| POST | `/api/google/offerings/{id}/sync-roster` | Reconcile Classroom membership against `enrolments` | Registrar, Service |
| GET | `/api/google/provisioning-status` | What is provisioned and what failed | Registrar |

These are the only endpoints that call outward. They use a service account with
domain-wide delegation; the JSON key is a Vercel secret and never enters the
repository. Both target columns are nullable and both have a `UNIQUE`
constraint, which is what lets provisioning be a retrying background job instead
of something that must succeed while the registrar waits.

### 6.14 Jobs — 4

`X-Cron-Secret` only. These reject any request carrying a session cookie.

| Method | Path | What it does | Who |
|---|---|---|---|
| POST | `/api/jobs/fee-reminders` | WhatsApp or email the `due_soon` and `overdue` lists | Service |
| POST | `/api/jobs/provision-pending` | Retry every class and offering still missing its Google record | Service |
| POST | `/api/jobs/nightly-checks` | Read the three should-be-empty views, alert if not | Service |
| POST | `/api/jobs/admissions-nudge` | Flag leads nobody has contacted in 7 days | Service |

A fee reminder tells a student what they owe and where to pay it. It carries no
link that takes money, because there is none.

---

## 7. The same thing from the other side: what each role can reach

| Role | Reads | Writes | Cannot touch |
|---|---|---|---|
| **Public** | catalogue, health | one enquiry | everything else |
| **Applicant** | their own application | their own documents | any other record; no lookup by phone |
| **Student** | their own enrolment, timetable, courses, fees, documents | their own documents | anybody else's anything |
| **Lecturer** | their offerings and those rosters | nothing | other lecturers' classes, all fees, all admissions |
| **HoD** | their department: classes, students, offerings, staff, teaching load, fee status, funnel | offerings and teaching assignments in their department | other departments; receipts; roles; student records |
| **Registrar** | all academic records | students, enrolments, classes, offerings, curriculum, calendar, documents, Google provisioning | fee schedules, receipts, waivers, role grants |
| **Bursar** | students and enrolments as context; everything in fees | fee schedules, instalments, charges, waivers, receipts, reversals | academic records, admissions, roles |
| **Admissions** | the funnel | admission stages, contact logs, accepting a candidate | fees, classes, curriculum, roles |
| **Administrator** | everything | everything, including role grants and the current academic year | nothing |
| **Service** | what each job needs | reminders sent, provisioning retried | no endpoint outside §6.14 |

Two separations worth defending, because small institutes usually collapse them
and regret it:

**The registrar cannot record money and the bursar cannot change a mark or a
class.** Fees and academic records are the two things a school can be accused of
falsifying, and one person holding both means no record of who did what. Nothing
stops the Director from granting both roles to one person on a thin day — but it
will be a decision, recorded in `staff_roles` with a date and a `granted_by`,
rather than an accident of how the software was built.

**Only the administrator grants roles.** Permission to widen permission is the
one thing that must not be delegated, or the distinction above dissolves the
first time somebody is in a hurry.

---

## 8. The three endpoints that do more than one thing

Everything else is a query. These three are transactions, and they are where
bugs would be expensive.

**`POST /api/enrolments`** — one `BEGIN`:
1. Check the student has no other `active` enrolment (a partial unique index
   enforces this too; the check is for a civil error message).
2. Insert the `enrolments` row.
3. Find the `fee_schedule` matching the class's year, department, specialisation
   and level — department-wide at Level 1, per specialisation above it.
4. **Copy** every `fee_schedule_installments` row into `student_charges`.
5. Return the enrolment with its charges.

If step 3 finds nothing, the whole thing fails with `422` saying which schedule
is missing. An enrolment with no charges is a student nobody will ever invoice,
and it is better to refuse than to create one quietly.

**`POST /api/admissions/{id}/accept`** — one `BEGIN`:
1. Insert into `persons` from the admission row, or reuse an existing person if
   the phone number already matches one.
2. Insert into `students`, which requires guardian name and phone — so the
   endpoint demands them and returns `422` naming them if the admissions officer
   has not collected them.
3. Set the admission `stage` to `accepted`, with `decided_at` and `decided_by`.
4. Return the new `student_id`, ready for `POST /api/enrolments`.

Deliberately two steps, not one: accepting a candidate and seating them in a
class are decisions made by different people, often days apart.

**`POST /api/fees/receipts`** — not multi-table, but it has the one race that
matters. Two clerks keying the same slip at once are stopped by
`receipt_no UNIQUE` at the database, not by a check-then-insert in the handler,
which is exactly the pattern that lets duplicates through under load.

---

## 9. Conventions, once, for all 89

**Errors.** Always this shape, never a bare string:

```json
{ "error": { "code": "validation_failed",
             "message": "received_on cannot be in the future",
             "field": "received_on" } }
```

| Code | HTTP | When |
|---|---|---|
| `unauthenticated` | 401 | no session, or expired |
| `forbidden` | 403 | signed in, role or scope insufficient |
| `not_found` | 404 | also returned instead of 403 where confirming existence would itself leak something |
| `validation_failed` | 422 | failed the zod schema or a business rule |
| `conflict` | 409 | duplicate `receipt_no`, second active enrolment, second head of department |
| `rate_limited` | 429 | public endpoints only |
| `server_error` | 500 | logged with a request id, returned without internals |

**Validation.** One zod schema per endpoint, in the route file, applied before
anything touches the database. Phone numbers are normalised to `+237…` before
validating, because the `CHECK` in the schema will reject anything else and a
clerk typing `677 487 127` should be helped, not refused.

**Pagination.** `?limit=` (default 50, max 200) and `?cursor=`, keyset on
`created_at, id`. No `OFFSET`: it drifts while someone is reading page 3.

**Lists return a shape, not a bare array.** `{ "data": [...], "next_cursor":
"..." }`, so filters and totals can be added without breaking a caller.

**Dates.** `received_on`, `due_on` and friends are plain `date` strings
(`2026-10-12`) because they are days, not instants. Everything ending in `_at`
is UTC ISO 8601. Cameroon is UTC+1 with no daylight saving, so day boundaries in
reports are computed in `Africa/Douala` explicitly rather than left to the
server's locale.

**Money.** Whole francs as integers, in every direction. No decimals, no
thousands separators, no currency string in the body — `currency` is checked to
`XAF` in the database and there is nothing to choose.

**Mutations check the `Origin` header** against the deployment's own origin.
With `SameSite=Lax` cookies that is sufficient CSRF protection here, and avoids a
token-passing dance for an app with one origin.

**Writes are logged.** Who, what endpoint, which row, when — see the gap in
§12.

---

## 10. What this API deliberately does not have

Each of these is a decision, not an omission.

- **No payment initiation, no gateway callback, no webhook.** The thing you
  asked to remove. There is no URL in this system that moves money.
- **No public student lookup.** No `GET /api/students?phone=…` for an
  unauthenticated caller. A matricule or a phone number is not a password, and
  an endpoint that confirms "this person is a WIPEG student" to anyone who asks
  is a privacy leak with a friendly name.
- **No `DELETE` on anything that constitutes a record.** Students, enrolments,
  payments received and admissions are closed by status, not removed. The only
  `DELETE` in §6 is on an offering nothing is attached to yet.
- **No bulk import endpoint.** Last year's students will be loaded by a
  reviewed script against the database, once, not by an HTTP route that lives
  forever and can be pointed at the wrong file.
- **No self-registration.** A Google account is created by the registrar after
  acceptance. If signing up created a `students` row, the student roll would be
  editable by strangers.
- **No marks or transcripts yet.** `course_offerings` is the right place to hang
  assessment from, and nothing in this design blocks it, but guessing WIPEG's
  grading scheme would be worse than leaving the room for it.
- **No student-facing fee payment page.** Deliberate and worth saying out loud
  to the administration: `/api/me/fees` shows a student what they owe and where
  to pay. It cannot take the money.

---

## 11. Secrets this needs

All in Vercel environment variables, none in the repository, none in a client
bundle. Anything prefixed `NEXT_PUBLIC_` is public by definition; none of these
are.

| Variable | Used by |
|---|---|
| `DATABASE_URL` | every handler |
| `SUPABASE_SERVICE_ROLE_KEY` | Storage uploads and signed URLs |
| `SESSION_SECRET` | signing the session cookie |
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` | §3 sign-in |
| `GOOGLE_WORKSPACE_DOMAIN` | pinning `hd=` so only WIPEG accounts can sign in |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | §6.13 provisioning |
| `ADMISSION_TOKEN_SECRET` | applicant status links |
| `CRON_SECRET` | §6.14 jobs |
| `TURNSTILE_SECRET_KEY` | the public enquiry form |

The Google service-account key is the most dangerous of these: with domain-wide
delegation it can act as any user in the Workspace. It should be scoped to the
two Admin SDK and Classroom scopes actually listed in §6.13 and nothing more.

---

## 12. Gaps to close before building

Four are mine to flag; the rest need the administration.

**1. The enquiry form does not collect enough to create an admission.**
`src/components/site/EnquiryForm.tsx` posts `name`, `phone`, `email`,
`programme` and `message` — and currently opens a `mailto:` rather than calling
anything. But `admissions` needs a campus, a level and an academic year. Two
selects have to be added to that form, or `POST /api/admissions/enquiries` has
to guess, and guessing a campus is how a Garoua lead ends up on the Yaoundé
list. **This is the first thing to fix, because it blocks endpoint 7.**

**2. The testimonial form has nowhere to land.**
`src/components/site/TestimonialForm.tsx` collects name, role, programme, year,
contact, quote and a consent tick, and also opens a `mailto:`. There is no
`testimonials` table in the schema — I did not add one while designing something
else. It needs about six columns and a moderation flag, plus
`POST /api/testimonials` (public, rate limited) and
`PATCH /api/testimonials/{id}` (administrator, to approve). Say the word and it
is twenty minutes.

**3. There is no audit log.** Money is append-only and role grants are
revoke-not-delete, so the two most sensitive areas are already traceable. But
nothing records that a student's matricule was changed on a Tuesday, or who
changed a fee schedule. One `audit_log` table — actor, action, table, row id,
before, after, timestamp — written by the same helper that already wraps every
mutation. I recommend it before go-live, not after.

**4. Rate limiting needs a store.** Vercel functions are stateless, so the
limits in §6.2 need Upstash Redis or the Supabase table equivalent. Small, but
it is a dependency and not free.

**Still needed from the administration** (unchanged from `DESIGN.md` §10, and
all of it blocks real data rather than building): the matricule format, the
specialisation codes, **the actual course list** — subject codes, titles, credit
hours, and which specialisation and level each belongs to, which is the biggest
gap of all — the fee structure per specialisation and level with instalment
amounts and due dates, how many semesters a WIPEG year has, the staff list, and
confirmation that Levels 1–2 = HND, 3 = Bachelor, 4–5 = Master holds in every
department.

---

## 13. Build order

Each step is deployable and useful on its own. I would not build §6 top to
bottom; I would build the spine first and hang the rest off it.

| | Step | Why here |
|---|---|---|
| 1 | Create the Supabase project, apply `schema.sql`, seed the real campuses, departments and specialisations from `src/data/site.ts` | Everything below needs a database. Two minutes, waiting on your go-ahead |
| 2 | `src/server/db.ts`, `auth.ts`, `errors.ts`, `validate.ts` | The four files every handler imports. Written once, wrongly once |
| 3 | §6.1 sign-in, and `GET /api/me` | Nothing can be authorised until someone can sign in |
| 4 | Fix the enquiry form, then §6.2 | The only part with a public user waiting. Turns the mailto into a lead the admissions officer can actually work |
| 5 | §6.7 admissions back office, including `accept` | Makes step 4 worth something, and produces the first real students |
| 6 | §6.11 catalogue, then §6.8 classes and offerings | Needed before anyone can be enrolled |
| 7 | §6.9 enrolment, with the transaction in §8 | The spine. From here the database holds a real student roll |
| 8 | §6.10 fees | Needs enrolments to exist first, since charges hang off them |
| 9 | §6.3 and §6.4 self-service | The first thing students and lecturers see. Nothing new underneath it — all reads |
| 10 | §6.5, §6.6, §6.12 records, staff, reports | Administration catching up with the data already there |
| 11 | §6.13 Google provisioning, then §6.14 jobs | Last on purpose: both are retryable background work, and both are easier once there are real classes to provision |

Steps 1 to 3 are a day. Step 7 is the one worth reviewing carefully.
