# Build the WIPEG backend — 12 steps

## How to use this file

Open this project in VS Code with Claude Code. For each step, paste **exactly
this** into the chat, changing only the number:

> Read `prompt.md`. Do **Step 3** only. Stop when its "Done when" checks pass.
> Do not start any later step.

Then check the work yourself before moving on. One step per session is ideal;
two is fine. **Twelve steps in one session is not** — that is how you get 4,000
lines nobody has read, where the sign-in is subtly wrong and every endpoint
inherits it.

Tick them off here as you go:

- [ ] 1 — A database to talk to
- [ ] 2 — Skeleton that starts and answers
- [ ] 3 — Sign in with Google
- [ ] 4 — The guards, the validator, the audit log
- [ ] 5 — Public catalogue and the enquiry form
- [ ] 6 — Call booking with Google Calendar
- [ ] 7 — The admissions desk and the call diary
- [ ] 8 — Catalogue, calendar, classes and subjects
- [ ] 9 — Enrolment
- [ ] 10 — Fees
- [ ] 11 — Student and lecturer self-service
- [ ] 12 — Jobs, WhatsApp reminders, Google provisioning

---

## Standing rules — these apply to every step

**Read these three files before writing any code, in every step:**

| File | What it is |
|---|---|
| `db/API.md` | All 102 endpoints and who may call each. **The contract. Do not invent endpoints that are not in it, and do not change a path.** |
| `db/schema.sql` | 26 tables, 12 views. Already written and tested. |
| `db/DESIGN.md` | Why the schema is shaped this way. Read before arguing with it. |

**Architecture: Models, Controllers, Routes. No exceptions.**

```
backend/src/
  models/        one file per table — the ONLY place SQL is written
  controllers/   one exported function per endpoint — decides; never writes SQL
  routes/        address → controller, and declares who may call it
  middleware/    sign-in, role checks, validation, errors, rate limits, audit
  services/      the outside world: Google, WhatsApp, storage, tokens
  jobs/          the six timed tasks
  lib/           db pool, settings, errors, logger, response helpers
  app.ts / server.ts
```

- A controller containing `SELECT`, `INSERT` or `UPDATE` is a bug. Move it to a
  model.
- A model that reads `req`, checks a role, or returns an HTTP status is a bug.
  Models take arguments and return rows.
- A route file is where the question "who can do this?" is answered. One
  guard per route, visible on the line.

**Never do these:**

1. **Do not change `db/schema.sql` unless a step says to.** The schema is
   tested by `db/test_rules.py` (66 assertions). If you think it is wrong, say
   so and stop — do not edit it quietly.
2. **No ORM.** Plain SQL with `pg`, parameterised. The database enforces rules
   an ORM would hide: the Level 1 rule, one active enrolment per student, one
   head per department, instalments that must add up.
3. **No string-built SQL.** `$1, $2` parameters always, even for an internal id.
4. **Never put a secret in a file that git tracks.** `.env` only, and `.env` is
   ignored. Never log a token, a key or a password.
5. **Never trust the client for identity.** `recorded_by`, `granted_by`,
   `decided_by` and every "which student is this" come from the session, never
   from the request body.
6. **No `DELETE` on records.** Status columns close things. The only `DELETE`
   in `API.md` is a subject offering nothing is attached to.
7. **Do not touch `src/`, `frontend/` or the live website.** Backend only.
8. **Money is whole francs as integers.** XAF has no subunit. No floats
   anywhere near an amount.

**The three users, every time:**

| Role | How the system knows | Reach |
|---|---|---|
| **Admin** | a `staff` row **and** a live `admin` row in `staff_roles` | everything |
| **Lecturer** | a `staff` row | only offerings in their `teaching_assignments` |
| **Student** | a `students` row | their own record only |

Plus: unauthenticated visitors, holders of a signed link (booked a call or sent
an enquiry — no password, ever), and the timed jobs, which carry `CRON_SECRET`
and refuse to run for a request with a session cookie.

**Every step ends the same way:** run the step's checks, run `npm test`, run
`npx tsc --noEmit`, then write two or three sentences on what you built, what
you chose, and anything in `API.md` that turned out wrong. Then stop.

---

## The design: every file, before any of it is written

This is the whole backend on one page. Each step builds a slice of it. Nothing
outside this list should appear in `backend/src/`.

### Models — one per table, 25 files

```
campus          department      award           level           specialisation
course          curriculum      academicYear    term
person          student         staff           staffRole       document
class           offering        teachingAssignment               enrolment
admission       admissionContact                appointment
feeSchedule     studentCharge   feeReceipt
report          ← the 12 views, read-only, one function each
```

Each exports plain functions: `findById`, `list`, `create`, `update`, and
whatever that table actually needs — `appointment.findOverlapping`,
`feeReceipt.sumForEnrolment`, `staffRole.liveRolesFor`. No base class, no
inheritance, no generic repository.

### Controllers — 18 files, grouped as `API.md` groups them

| Controller | `API.md` group | Endpoints |
|---|---|---|
| `auth` | A | 3 |
| `me` | D, E | 7 |
| `catalogue` | B | 2 |
| `enquiries` | B | 3 |
| `booking` | C | 5 |
| `admissions` | F | 7 |
| `appointments` | G | 6 |
| `students` | H | 5 |
| `persons` | H, M | 3 |
| `staff` | I | 6 |
| `classes` | J | 4 |
| `offerings` | E, J | 7 |
| `enrolments` | K | 4 |
| `fees` | L | 12 |
| `catalogueAdmin` | M | 11 |
| `reports` | N | 5 |
| `google` | O | 5 |
| `jobs` | P | 6 |

### Routes — one file per controller, plus `routes/index.ts`

`index.ts` mounts them all under `/api` and is the one place to see the whole
surface. A route file looks like this and nothing more:

```ts
import { Router } from 'express';
import * as fees from '../controllers/fees.controller';
import { requireAdmin, requireStudentOrAdmin } from '../middleware/requireAuth';
import { validate } from '../middleware/validate';
import { receiptSchema, waiverSchema } from '../schemas/fees.schema';

const router = Router();

router.get ('/fees/status',             requireAdmin,                          fees.status);
router.get ('/fees/arrears',            requireAdmin,                          fees.arrears);
router.post('/fees/receipts',           requireAdmin, validate(receiptSchema), fees.recordReceipt);
router.post('/fees/receipts/:id/reverse', requireAdmin,                        fees.reverseReceipt);
router.get ('/enrolments/:id/charges',  requireStudentOrAdmin('enrolment'),    fees.charges);

export default router;
```

### Middleware — 7 files

| File | Exports |
|---|---|
| `requireAuth.ts` | `requireCaller`, `requireAdmin`, `requireStudent`, `requireLecturerFor(param)`, `requireSelfOrAdmin(kind)` |
| `requireCronSecret.ts` | the job guard |
| `requireLinkToken.ts` | resolves `:token` to one admission or appointment |
| `validate.ts` | wraps a zod schema; 422 with the field name |
| `rateLimit.ts` | per-IP and per-phone limits on public writes |
| `audit.ts` | records every write: who, what, which row, before, after |
| `errorHandler.ts` | turns a typed error into the one JSON shape |

### Services — 8 files

`googleAuth`, `googleCalendar`, `googleDirectory`, `googleClassroom`,
`whatsapp`, `storage`, `linkToken`, `turnstile`.

Every one is a thin wrapper that can be swapped for a fake in tests. No
controller calls `googleapis` directly.

### Jobs — 6 files

`appointmentReminders`, `syncCalendar`, `feeReminders`, `provisionPending`,
`nightlyChecks`, `admissionsNudge`.

Each exports one `run()` that returns a count of what it did. The job endpoints
in group P are three lines each: check the secret, call `run()`, return the
count.

---

# Step 1 — A database to talk to

**Goal:** a real Postgres with the WIPEG schema in it, and a `DATABASE_URL`
that reaches it.

**Do:**
1. Check with Fai whether the Supabase project exists yet. If not, **stop and
   ask** — creating it costs money and is his decision, not yours.
2. Once it exists, apply `db/schema.sql` to it. Confirm 26 tables and 12 views.
3. Seed the real campuses, departments and specialisations from
   `src/data/site.ts`. Read that file; do not invent names, codes or
   specialisations. Anything you cannot find there, leave out and list it.
4. Create one `persons` + `staff` + `staff_roles('admin')` row for Fai, with
   his real school email, so there is an admin to sign in as. Ask him for the
   address; do not guess it.
5. `cp backend/.env.example backend/.env` and fill in `DATABASE_URL`. Do not
   commit `.env`.

**Done when:** `psql "$DATABASE_URL" -c "\dt"` lists 26 tables, the campuses
and departments match `src/data/site.ts` exactly, and one admin exists.

**STOP.** Write down what you seeded and what you could not.

---

# Step 2 — A skeleton that starts and answers

**Goal:** `npm run dev` starts, `GET /api/health` returns the truth. Nothing
else.

**Create:**
```
backend/package.json         backend/tsconfig.json
backend/src/lib/env.ts       backend/src/lib/db.ts
backend/src/lib/errors.ts    backend/src/lib/logger.ts
backend/src/lib/http.ts
backend/src/app.ts           backend/src/server.ts
backend/src/routes/index.ts
backend/src/controllers/catalogue.controller.ts   ← health only, for now
backend/src/routes/catalogue.routes.ts            ← health only, for now
```

**Do:**
- Node 20+, TypeScript strict, Express 5, `pg`, `zod`, `vitest`, `tsx` for dev.
- `env.ts` validates every setting with zod **at boot** and exits with a clear
  message naming the missing one. A backend that starts without
  `SESSION_SECRET` and fails at the first sign-in is worse than one that
  refuses to start.
- `db.ts` exports a single pool, `query<T>(sql, params)`, and
  `withTransaction(fn)`. Nothing else opens a connection.
- `errors.ts` exports `AppError` and the seven codes from `API.md`:
  `unauthenticated`, `forbidden`, `not_found`, `validation_failed`, `conflict`,
  `rate_limited`, `server_error`.
- `http.ts` exports `ok(res, data)` and `paged(res, rows, nextCursor)` so every
  list returns `{ data, next_cursor }` and nobody has to remember.
- `errorHandler` is the last middleware. An unexpected error logs with a
  request id and returns `server_error` — never a stack trace, never a database
  message.
- Port 6008. The website uses 6007; never use 3000.

**Done when:** `npm run dev` starts clean, `GET /api/health` returns
`{"data":{"status":"ok","database":"ok"}}`, deleting `DATABASE_URL` from `.env`
makes the process refuse to start with a message naming it, and
`npx tsc --noEmit` is silent.

**STOP.**

---

# Step 3 — Sign in with Google

**Goal:** Fai can sign in with his WIPEG Google account, and `GET /api/me` says
he is an admin. Nobody else can get in.

**Create:** `models/person.model.ts`, `models/student.model.ts`,
`models/staff.model.ts`, `models/staffRole.model.ts`,
`services/googleAuth.service.ts`, `middleware/requireAuth.ts` (only
`requireCaller` for now), `controllers/auth.controller.ts`,
`controllers/me.controller.ts` (only `GET /api/me`), and their route files.

**Endpoints:** group A of `API.md` — all four.

**Do:**
- The sign-in URL pins `hd=GOOGLE_WORKSPACE_DOMAIN`. **Then check the verified
  email's domain again** when Google calls back. `hd` is a hint to Google's UI,
  not a guarantee, and treating it as one is a real hole.
- Match on `lower(school_email)`. No row → `403`, and **create nothing**. A
  Google account must never bring a person record into existence.
- Session cookie: `httpOnly`, `secure` outside development, `SameSite=Lax`,
  signed with `SESSION_SECRET`, expires in `SESSION_HOURS`. It holds
  `person_id` and nothing else.
- **Resolve roles from the database on every request**, not from the cookie.
  Removing somebody's admin should take effect on their next click, not at
  their next sign-in.
- `requireCaller` attaches
  `{ person_id, is_student, is_staff, is_admin, teaches_offering_ids[] }` in one
  query, cached for the request.
- `GET /api/me` returns name, email, and which of the three roles apply. It
  must work for a student with no staff row and for staff with no student row.

**Done when:** signing in with the seeded admin returns `is_admin: true`; a
Google account on any other domain is refused; a tampered cookie gives
`unauthenticated`; `GET /api/me` without a cookie gives `401` in the standard
error shape.

**STOP.**

---

# Step 4 — The guards, the validator, the audit log

**Goal:** every protection the other 98 endpoints will rely on, written once
and tested. No new features.

**Create:** the rest of `middleware/requireAuth.ts`,
`middleware/requireCronSecret.ts`, `middleware/requireLinkToken.ts`,
`middleware/validate.ts`, `middleware/rateLimit.ts`, `middleware/audit.ts`,
`services/linkToken.service.ts`, `models/auditLog.model.ts`.

**This step also changes the database** — the one step that is allowed to.
Add to `db/schema.sql`, before the views:

```sql
-- Who did what. With a single Admin role, everybody who can enter a receipt
-- can also change a matricule and a fee schedule, so the record of who
-- actually did it is the control that remains. Append-only; never edited.
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES persons(id) ON DELETE RESTRICT,
  actor_email text,                  -- kept flat: readable even if the row moves
  action      text NOT NULL,         -- 'fee_receipt.create', 'student.update'
  table_name  text NOT NULL,
  row_id      text,
  before_data jsonb,
  after_data  jsonb,
  request_id  text,
  ip          inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_actor  ON audit_log (actor_id, created_at DESC);
CREATE INDEX audit_log_row    ON audit_log (table_name, row_id);
CREATE INDEX audit_log_recent ON audit_log (created_at DESC);
```

Then: add the matching `DROP` to `db/rollback.sql`, add assertions to
`db/test_rules.py` (an entry with no actor is allowed — jobs have none; an
entry with no action is refused), and **run `python db/test_rules.py` — it must
still pass everything.** Update the counts in `db/DESIGN.md` and `db/API.md`.

**Do:**
- `requireAdmin` — live `admin` row in `staff_roles`, `revoked_on IS NULL`.
- `requireStudent` — a `students` row. Used only by `/api/me/*`.
- `requireLecturerFor(param)` — the offering named by that URL parameter must
  appear in the caller's `teaching_assignments`. An admin passes too. Job title
  alone grants nothing.
- `requireSelfOrAdmin(kind)` — for the three endpoints a student may call about
  their own enrolment, charges or documents. Resolve ownership with a query;
  never compare ids the client sent.
- `requireLinkToken` — HMAC over `(kind, row_id, expires_at)` with
  `LINK_TOKEN_SECRET`. Compare in constant time. Expired or wrong → `404`, not
  `403`: confirming that a booking exists is itself a leak.
- `validate(schema)` — zod, body/query/params, `422` naming one field. Phone
  numbers are normalised to `+237…` **before** validating, so `677 487 127` is
  helped rather than refused.
- `rateLimit` — per IP and per phone number, as in `API.md` group B.
  `REDIS_URL` when set, memory when not, and say in the log which is in use.
- `audit` — wraps every write. Takes actor from the session, action from the
  route, before/after from the model. If audit insertion fails, the request
  still fails: an unlogged write is not an acceptable outcome.

**Done when:** a unit test exists for each guard proving it **refuses** the
wrong caller (not just that it allows the right one); the schema tests still
pass; a write through any existing endpoint leaves an `audit_log` row with the
right actor.

**STOP.**

---

# Step 5 — Public catalogue and the enquiry form

**Goal:** `API.md` group B, all five. The first step with a real person waiting.

**Create:** `models/admission.model.ts`, `services/turnstile.service.ts`,
`controllers/enquiries.controller.ts`, the real
`controllers/catalogue.controller.ts`, their routes, and the catalogue models
(`campus`, `department`, `specialisation`, `level`, `award`).

**Do:**
- `GET /api/catalogue` is one query per table, cached in memory for an hour,
  and shaped so the website can render the programmes menu from it alone.
- `POST /api/enquiries` creates an `admissions` row at stage `lead`. It needs
  campus, department **and** level — `admissions` requires all three. **The
  current form does not collect campus or level** (`API.md`, Known gaps 1). Do
  not guess them: return `422` naming them, and note in your report that the
  form needs two more fields. Step 6 builds the form that collects them.
- A second enquiry from the same phone in the same academic year updates the
  existing row rather than creating a duplicate lead.
- Turnstile token required. Rate limits from step 4.
- The response contains the private link from `linkToken`. It must not contain
  the admission's uuid.
- `GET /api/enquiries/:token` returns stage and missing documents. Nothing
  else — no internal notes, no other candidates, no staff names.

**Done when:** a valid form creates exactly one lead; the same phone twice
creates one row, not two; a missing campus returns `422` naming `campus_id`;
the sixth attempt in an hour returns `rate_limited`; the token link opens that
one enquiry and a tampered token returns `404`.

**STOP.**

---

# Step 6 — Call booking with Google Calendar

**Goal:** `API.md` group C, all five. A visitor books a call, it lands in Google
Calendar, and the admissions office can see it.

Read **Part 2 of `db/API.md`** first — it describes this whole flow as a story.

**Create:** `models/appointment.model.ts`,
`services/googleCalendar.service.ts`, `controllers/booking.controller.ts`,
`routes/booking.routes.ts`.

**Do:**
- `GET /api/booking/slots` builds the slot grid from the `BOOKING_*` settings
  (timezone, open and close time, days, slot length, days ahead, minimum
  notice), asks Google Calendar free/busy for `GOOGLE_CALENDAR_ID`, removes
  anything busy, and removes anything already in `appointments`. Cache 60
  seconds. Times go out as ISO instants with an offset, never as naive local
  strings.
- `POST /api/booking` in **one transaction**: create the `admissions` row at
  stage `lead` (reusing an existing row for the same phone and year), then the
  `appointments` row. Both or neither.
- **Writing the Google event happens after the transaction commits, and is
  allowed to fail.** Store `google_event_id` when it succeeds; leave it null
  when it does not, and let the step 12 job pick it up. A visitor must never be
  told to try again because Google was slow.
- The calendar event description carries name, phone, campus, department and
  level — enough to take the call without opening the system. The title does
  not contain the phone number, because calendar titles show on shared screens.
- The slot clash is caught by the database's unique index on
  `(staff_id, starts_at)`, not by checking first and inserting after. Turn the
  violation into `conflict` with a message saying the slot has gone, and
  return the refreshed slot list in the same response.
- Reschedule moves the row and **patches** the existing Google event, never
  creating a second. Cancel sets `status = 'cancelled'` with a reason — which
  the database requires — and deletes the calendar event.
- Rate-limited and Turnstile-checked like the enquiry form. Minimum notice is
  enforced server-side; a client can send any time it likes.

**Done when:** slots never include a busy time or an already-booked slot; two
simultaneous bookings for the same slot produce one success and one `conflict`;
breaking the Google credentials still produces a saved booking with a null
`google_event_id`; reschedule leaves exactly one calendar event; cancel without
a reason returns `422`.

**STOP.**

---

# Step 7 — The admissions desk and the call diary

**Goal:** `API.md` groups F and G — 13 endpoints. The office can now work what
steps 5 and 6 bring in.

**Create:** `models/admissionContact.model.ts`,
`controllers/admissions.controller.ts`,
`controllers/appointments.controller.ts`, their routes. Extend
`models/appointment.model.ts` and `models/report.model.ts`.

**Do:**
- `GET /api/admissions` reads the funnel with filters from `API.md`. Keyset
  paging, newest first, and a `never_contacted` filter — the
  `admissions_funnel` view already computes that.
- `POST /api/admissions/:id/accept` is a transaction: create or reuse the
  person, create the `students` row, set stage `accepted` with `decided_by`
  from the session. Guardian name and phone are `NOT NULL` on `students`, so
  refuse with `422` naming them if the desk has not collected them. **Do not
  enrol anybody here** — that is step 9, and usually a different person on a
  different day.
- Reuse an existing person when the phone already matches one. Two records for
  one human is the failure this whole schema is shaped to avoid.
- `GET /api/appointments` reads the `appointment_diary` view, **unclaimed calls
  first** — a null staff name is what the morning meeting is about.
- `POST /api/appointments/:id/assign` sets `staff_id` from the session, and
  returns `conflict` if somebody else claimed it first.
- `POST /api/appointments/:id/outcome` writes `held` or `no_show` **and** an
  `admission_contacts` row, so the note sits with every other call and message
  about that candidate rather than only on the booking.
- Admin reschedule and cancel reuse the step 6 service. One code path for
  Google Calendar, not two.

**Done when:** accepting a candidate with a phone that already exists creates a
student but no second person; accepting without a guardian returns `422` naming
it; two admins claiming one call produce one success and one `conflict`;
marking a call held leaves both the appointment status and a contact log entry.

**STOP.**

---

# Step 8 — Catalogue, calendar, classes and subjects

**Goal:** `API.md` groups J and M — 20 endpoints. The structure a student can be
enrolled into.

**Create:** `models/course.model.ts`, `curriculum`, `academicYear`, `term`,
`class`, `offering`, `teachingAssignment`, `document`;
`controllers/catalogueAdmin.controller.ts`, `classes.controller.ts`,
`offerings.controller.ts`, `persons.controller.ts`;
`services/storage.service.ts`.

**Do:**
- **The Level 1 rule is the thing to get right here.** Level 1 is
  department-wide and carries no specialisation; Level 2 and above must have
  one. The database enforces it with a `CHECK` in four tables. Your job is to
  turn the violation into a sentence a registrar understands, not to
  re-implement the rule.
- A course belongs to no department. `curriculum_entries` places it at a
  department, an optional specialisation, a level and a term. `PUT /api/curriculum`
  replaces the set for one department-level-term in a transaction.
- `POST /api/academic-years` creates the year and its terms together. Ask how
  many semesters rather than assuming two — that is still an open question in
  `API.md`.
- `make-current` relies on the database's single-current index. Catch the
  violation, do not pre-check.
- `PUT /api/offerings/:id/teachers` replaces the assignment set in one
  transaction: at most one `lead`, enforced by a partial unique index.
- Documents: upload to a **private** Supabase Storage bucket. The database
  stores the key only. `GET /api/documents/:id/download` returns a 60-second
  signed URL and is the only way to read one. Never make the bucket public.
- `DELETE /api/offerings/:id` is the only delete in the system. It must fail
  with `conflict` if anything is attached.

**Done when:** a Level 1 class with a specialisation is refused with a readable
message; a Level 2 class without one likewise; two leads on one offering are
refused; a second current academic year is refused; an uploaded document is not
reachable without a signed URL.

**STOP.**

---

# Step 9 — Enrolment

**Goal:** `API.md` group K — 4 endpoints. **The spine. The one step to review
carefully.**

**Create:** `models/enrolment.model.ts`, `models/feeSchedule.model.ts`,
`models/studentCharge.model.ts`, `controllers/enrolments.controller.ts`.

**Do — `POST /api/enrolments`, in one transaction:**
1. The student must have no other `active` enrolment. A partial unique index
   enforces it; check first only to produce a civil message.
2. Insert the enrolment.
3. Find the `fee_schedule` for that class's year, department, specialisation
   and level — department-wide at Level 1, per specialisation above it.
4. **Copy** every `fee_schedule_installments` row into `student_charges`.
5. Return the enrolment with its charges.

Step 4 is a copy, not a reference, and that is the whole point of
`student_charges`: when fees rise next August, last year's students keep the
figures they agreed to. **Never** read a live fee at display time.

If step 3 finds no schedule, fail the whole thing with `422` naming the missing
schedule — year, department, specialisation, level. An enrolled student with no
charges is one nobody will ever invoice, and a silent success here is the
expensive kind of bug.

**Done when:** enrolling copies exactly the instalments on the schedule, with
the same amounts and dates; a second active enrolment is refused; a missing fee
schedule leaves **no** enrolment row behind; changing the schedule afterwards
does not change an existing student's charges.

**STOP.** Ask Fai to look at this one before step 10.

---

# Step 10 — Fees

**Goal:** `API.md` group L — 12 endpoints. Recording money, never taking it.

**Create:** `models/feeReceipt.model.ts`, `controllers/fees.controller.ts`.

**Do:**
- **Nothing here takes a payment.** No gateway, no webhook, no redirect to a
  payment page. If you find yourself adding an SDK, you have misread the brief.
- `POST /api/fees/receipts` takes enrolment, receipt number, amount, method,
  date on the slip, and optionally a bank reference and a note. `recorded_by`
  comes from the session. A duplicate `receipt_no` is a `409 conflict` naming
  the receipt already on file — **let the unique index catch it**, do not check
  first. That is what makes the form safe to submit twice on a bad connection.
  Return the recalculated `fee_status` row so the screen shows the new balance
  without asking again.
- `POST /api/fees/receipts/:id/reverse` takes **only a reason**. Copy the
  amount from the row being cancelled and negate it; set `reverses_id`. Never
  accept an amount from the caller. Never update or delete the original.
- `PUT .../installments` replaces the set in a transaction and refuses unless
  the amounts add up to `tuition_total` — the database cannot check a sum
  across rows, which is why `fee_schedules_unbalanced` exists.
- `POST /api/charges/:id/waive` requires a reason; the database enforces that.
- `GET /api/fees/status` and `/arrears` read the views. Do not recompute a
  balance in TypeScript — the view is the definition.
- Amounts in and out are integers. A float in a money path is a bug even when
  the arithmetic happens to work.

**Done when:** the same receipt number twice gives one row and one `conflict`;
a reversal nets the balance to where it was and leaves both rows; instalments
that do not add up are refused; a waiver without a reason is refused; no
response anywhere contains a decimal amount.

**STOP.**

---

# Step 11 — Student and lecturer self-service

**Goal:** `API.md` groups D and E — 10 endpoints. All reads except one upload.

**Create:** the rest of `controllers/me.controller.ts`, the lecturer half of
`controllers/offerings.controller.ts`.

**Do:**
- Every `/api/me/*` endpoint takes the person from the session. **There is no
  id in the path and no id in the query, anywhere.** If one appears, this layer
  is broken.
- `GET /api/me/fees` reads that student's `fee_status` row plus their charges
  and receipts. It shows the balance and where to pay. **It has no pay button
  and no payment link**, because none exists.
- `GET /api/offerings/:id/students` is guarded by `requireLecturerFor('id')`.
  Test it with a lecturer who teaches a *different* offering and confirm `403`.
- `roster.csv` streams; it does not build a string in memory. Include matricule,
  surname, given names — not phone numbers or guardian details. A marking sheet
  gets emailed around.
- A student uploading a document goes to the same private bucket as step 8, and
  can only read their own.

**Done when:** a student signed in sees only their own everything; a lecturer
asking for an offering they do not teach gets `403`; a student calling a
lecturer endpoint gets `403`; no `/api/me/*` route accepts any identifier at
all.

**STOP.**

---

# Step 12 — Jobs, WhatsApp reminders, Google provisioning

**Goal:** `API.md` groups O and P — 11 endpoints. The background work.

**Create:** `services/whatsapp.service.ts`,
`services/googleDirectory.service.ts`,
`services/googleClassroom.service.ts`, all six files in `jobs/`,
`controllers/jobs.controller.ts`, `controllers/google.controller.ts`.

**Do:**
- Every job endpoint: check `CRON_SECRET`, refuse if the request carries a
  session cookie, call `run()`, return a count. Three lines.
- **`appointmentReminders`** reads the `appointments_needing_reminder` view —
  one query, everything the message needs is in it. For each row, send the
  WhatsApp template to `staff_phone`, or to `WHATSAPP_FALLBACK_STAFF_PHONE`
  when nobody has claimed the call. **Stamp `reminder_sent_at` immediately
  after the send succeeds**, one row at a time. That column is the only reason
  this job can run every five minutes forever without spamming anybody. Never
  stamp before the send; never stamp a batch after a loop that might have
  failed halfway.
- Meta rejects a template that is not approved. Handle that as a logged failure
  with a clear message, not a crash, and leave `reminder_sent_at` null so it
  retries once the template is live.
- **`syncCalendar`** creates Google events for bookings where
  `google_event_id IS NULL`. Safe to run forever because that column is unique.
- **`feeReminders`** messages `due_soon` and `overdue` students from
  `fee_status`. The message says what is owed and where to pay. **No payment
  link.** Once per student per day at most.
- **`provisionPending`** retries Groups and Classrooms. **`nightlyChecks`**
  reads `students_missing_required_data` and `fee_schedules_unbalanced` and
  alerts if either is not empty. **`admissionsNudge`** flags leads with no
  contact in 7 days.
- Google provisioning endpoints must be safe to call twice. The target column is
  unique in every case; rely on that.
- Log every outbound message: who, which template, when, and the provider's id.
  Never log the token.

**Done when:** running `appointmentReminders` twice sends one message; a failed
send leaves `reminder_sent_at` null; a job endpoint with a session cookie and no
secret is refused; a job endpoint with the secret and no cookie works; calling
a Google provisioning endpoint twice creates one Group.

**STOP. That is the backend.**

---

## After step 12

1. Run `python db/test_rules.py` and the full `npm test`. Both green.
2. Count the routes in `routes/` against the 102 in `db/API.md`. Report any
   gap in either direction — an endpoint that exists and is not documented is
   as much of a problem as one documented and missing.
3. Write `backend/SECURITY.md`: every guard, which endpoints use it, and the
   three places that depend on a database constraint rather than application
   code (receipt numbers, slot clashes, single active enrolment).
4. List what is still blocked on the administration: the subject list, the fee
   structure, the matricule format, office hours, and which staff phone the
   reminders go to.
5. Then — and only then — the frontend. `frontend/README.md` has the two
   decisions to make before anything moves.
