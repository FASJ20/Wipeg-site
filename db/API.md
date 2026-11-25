# The WIPEG backend, in plain language

**What this document is.** A complete list of everything the WIPEG system will
be able to do, who is allowed to do each thing, and in what order it should be
built. You do not need to be a programmer to read Parts 1 to 3.

**Status:** designed, not built. The folder `backend/` is empty except for its
structure. `prompt.md` in the project root is the step-by-step instruction set
for building it.

**Companions:** `db/DESIGN.md` explains the 24 tables. `db/schema.sql` is the
database itself.

---

## Before we start: five words you will keep seeing

| Word | What it means here |
|---|---|
| **Endpoint** | One thing the system can do, reachable at its own web address. "Record a receipt" is an endpoint. There are 84 of them. |
| **GET** | An endpoint that only *reads*. It changes nothing. Safe to call twice. |
| **POST / PATCH / PUT** | An endpoint that *writes* something — creates, changes or records. |
| **Token** | A long unguessable code in a link. We send these to visitors who have no account, so they can see their own booking and nothing else. |
| **Job** | Something the system does on a timer, with nobody logged in — like messaging students whose fee instalment is overdue. |

---

# PART 1 — The three users

You said there are three kinds of user, and the whole system is now built
around exactly those three.

| User | Who they are | What they can reach |
|---|---|---|
| **Admin** | The Director, the registrar's office, the bursary, the admissions desk | Everything. All students, all fees, all classes, all enquiries, all bookings, and the power to make someone else an admin |
| **Lecturer** | Anyone teaching at WIPEG | The classes they personally teach, and the students in them. Nothing else |
| **Student** | Anyone currently enrolled | Their own record only: their timetable, their subjects, their fees, their documents |

### How the system knows which one you are

Signing in is done with the WIPEG Google Workspace account — the
`@` school address. The system never holds a password.

```
  has a row in `students`                          →  Student
  has a row in `staff`                             →  Lecturer
  has a row in `staff` + an 'admin' grant          →  Admin
```

Being a lecturer needs no special permission; it is simply what having a staff
record means. **Admin is the only thing that gets granted**, it is recorded in
the `staff_roles` table with the date and the person who granted it, and only
an existing admin can grant it.

One person can be two things at once. A lecturer who is also the registrar is a
lecturer *and* an admin — the system checks "does this person have admin?", not
"is this person important enough?".

**Having a Google account is not enough on its own.** The email address must
already be written on a person's record in the database, which only an admin
can do. So a stranger with a Google account gets nowhere, and somebody who
leaves WIPEG is locked out twice over: once when their Workspace account is
switched off, and again when their staff record is marked `former`.

### Three kinds of caller who are not users

These are not people with logins. They need naming because they appear in the
tables in Part 3.

| Caller | What it is |
|---|---|
| **Anyone** | A visitor on the public website, not signed in to anything. Can read the course catalogue, send an enquiry, and book a call. That is all. |
| **Link holder** | Somebody who sent an enquiry or booked a call. The reply contains a private link. It opens *their one record* and nothing else. They never get a password. |
| **Automatic** | The system's own timed jobs. They use a secret key, not a login, and refuse to run for a signed-in person who finds the address. |

### One consequence of three roles worth knowing about

In an earlier draft the office was split four ways — registrar, bursar,
admissions, administrator — so that the person who records money could not also
change academic records. With one **Admin** role, anybody who can enter a
receipt can also change a matricule, a fee schedule and a class list.

For an institute of WIPEG's size that is a reasonable trade: fewer roles means
nobody is ever locked out of a job they need to do on a Saturday. It is worth
knowing because it means **the audit log in Part 4 matters more than it would
otherwise** — when everyone can do everything, the record of who actually did
what is the only control left. Splitting the role back out later is a one-line
change to the database and a one-word change in each route file.

---

# PART 2 — Booking a call, end to end

This is new, and it is the part of the system a visitor will touch first. Here
is the whole thing as a story.

**1. A visitor on the website clicks "Book a call".**
The page asks the system for free times. The system reads free/busy from the
WIPEG admissions Google Calendar, removes anything already taken, and offers
the remaining 30-minute slots inside office hours for the next 14 days.

**2. They pick a slot and say how they want to meet.**
Name, phone, optionally an email, and **online or at the campus**. Online
means a Google Meet link; onsite means they are coming to Garoua.

**3. The system writes one event onto the Google Calendar.**
The visitor's name, phone, department of interest and what they want to
discuss all go in the description, so whoever opens the event has everything
they need without looking anything up. An online booking gets a Meet link
attached; an onsite booking gets the campus address as the location.

Nothing is written to the WIPEG database except a single audit line. There is
no enquiry record, no lead stage, no second copy of the appointment.

**4. Google sends the invitation and the reminders.**
If the visitor gave an email they get a calendar invitation immediately, and
Google reminds both sides before the call. That is deliberate: a reminder
from Google arrives from an address every mail provider already trusts, where
one from a domain registered last week would land in spam.

**5. Staff see it on the phones they already carry.**
The booking appears on the shared calendar in everyone's Google Calendar app.
If the call has to move, they move it there, and it is moved — no second
system to update, nothing to reconcile, and nothing to train anybody on.

### What the booking is built on

| Piece | What it does |
|---|---|
| Google Calendar | The booking system. Not a mirror of one — the only copy |
| `freeBusy` query | What makes a slot appear free or not |
| Google Meet | Auto-attached to an online booking, by the same API call |
| `audit_log` row | One line, so "who booked this and when" is answerable without opening the calendar |

### What this costs, stated plainly

WIPEG cannot report on bookings with SQL, and if Google is down nobody can
book. Both are acceptable for a handful of calls a day, and both were
weighed against the alternative — a database table that drifts out of step
with what staff actually see.

If booking volume ever justifies reporting, copy the events into a table for
*reading*. Do not make the database the source of truth again.

---

# PART 3 — Every endpoint, and who can use it

84 endpoints. **Admin can use every one of them** except the ones marked
*Student* or *Link holder*, which are locked to whoever is signed in or holds
the link — an admin reads a student's fees through the fees list, not by
pretending to be them.

## A. Signing in — 4

| | Address | What it does | Who |
|---|---|---|---|
| GET | `/api/auth/google/start` | Send the person to Google to sign in | Anyone |
| GET | `/api/auth/google/callback` | Google sends them back; match the email to a person and start the session | Anyone |
| POST | `/api/auth/signout` | End the session | Anyone signed in |
| GET | `/api/me` | "Who am I?" — name, and whether student, lecturer or admin | Anyone signed in |

## B. The public website — 5

| | Address | What it does | Who |
|---|---|---|---|
| GET | `/api/health` | Is the system up, and is the database answering | Anyone |
| GET | `/api/catalogue` | Campuses, departments, courses offered, levels, awards. Cached for an hour | Anyone |
| POST | `/api/enquiries` | The enquiry form. Creates a lead in the admissions list | Anyone |
| GET | `/api/enquiries/:token` | A visitor checking their own enquiry | Link holder |
| POST | `/api/enquiries/:token/documents` | A visitor uploading a results slip early | Link holder |

The enquiry form is the only thing a stranger can write. It allows 5 attempts
per hour from one internet connection and 3 per day from one phone number,
requires a "not a robot" check, and treats a second enquiry from the same
number in the same year as an update rather than a new lead.

## C. Booking a call — 2

Booking lives in Google Calendar, not in this database. There is no
appointments table and no booking record to look up later: the shared WIPEG
calendar is the only copy, which is why staff can move a call from their
phone and have it actually move.

That is also why there are two endpoints here and not five. Rescheduling and
cancelling are done by whoever owns the calendar — the visitor replies to
Google's own invitation, or phones the campus.

| | Address | What it does | Who |
|---|---|---|---|
| GET | `/api/booking/slots?date=` | Free 30-minute slots on a day, read from Google Calendar | Anyone |
| POST | `/api/booking` | Book the call. Writes the event; an online call gets a Meet link, a campus visit gets the address | Anyone |

A booking carries `mode`: `online` or `onsite`. Online adds a Google Meet
link to the event; onsite sets the location to the Garoua campus. Google
sends the invitation and the reminders either way, from a Google address
rather than from a domain registered last week.

## D. Students — 6

Everything here shows the signed-in student their own record. There is no way
to ask for somebody else's — the address has no space for another person's id.

| | Address | What it does | Who |
|---|---|---|---|
| GET | `/api/me/enrolment` | Which class, level, campus; on campus or online | Student |
| GET | `/api/me/timetable` | This term's subjects and when they are taught | Student |
| GET | `/api/me/courses` | Subjects this year, with the lecturer's name | Student |
| GET | `/api/me/fees` | What they owe, what they have paid, what is due next | Student |
| GET | `/api/me/documents` | What is on file and what is still missing | Student |
| POST | `/api/me/documents` | Upload a birth certificate, GCE slip or photo | Student |

## E. Lecturers — 4

| | Address | What it does | Who |
|---|---|---|---|
| GET | `/api/me/teaching` | The subjects and classes this lecturer teaches | Lecturer |
| GET | `/api/offerings/:id` | One subject-in-a-class: term, colleagues, class size | Lecturer teaching it |
| GET | `/api/offerings/:id/students` | The class list | Lecturer teaching it |
| GET | `/api/offerings/:id/roster.csv` | The same list as a file to mark from | Lecturer teaching it |

A lecturer sees a class list only if the system says they teach that class.
Having the job title "Lecturer" opens nothing by itself.

## F — G. Removed: the admissions desk and the call diary

Thirteen endpoints used to sit here, managing a lead pipeline and a diary of
booked calls. Both are gone.

**The pipeline** assumed somebody advances a lead from `applied` to `offered`
every day. Nobody at WIPEG was going to, and a CRM nobody updates is worse
than no CRM — it shows stale stages that look authoritative. Enquiries are
answered on the phone and on WhatsApp, which is where they were being
answered anyway.

**The call diary** was a second copy of the calendar. See group C.

A person now first appears in this system at enrolment, which is the point
WIPEG actually commits to them.

## H. Admin — student records — 7

| | Address | What it does | Who |
|---|---|---|---|
| GET | `/api/students` | Search and list. Filter by campus, department, specialisation, level, year, status | Admin |
| GET | `/api/students/:id` | One student: details, enrolments, documents | Admin |
| POST | `/api/students` | Create a student from scratch | Admin |
| PATCH | `/api/students/:id` | Correct details, guardian, status | Admin |
| PUT | `/api/students/:id/matricule` | Record the number the office issued on paper | Admin |
| GET | `/api/persons/:id/documents` | Documents for a student or a lecturer | Admin, or the person themself |
| POST | `/api/persons/:id/documents` | File a scan against a person | Admin |

## I. Admin — staff and permissions — 6

| | Address | What it does | Who |
|---|---|---|---|
| GET | `/api/staff` | The staff list, filterable by department | Admin |
| GET | `/api/staff/:id` | One member of staff, their departments and teaching load | Admin |
| POST | `/api/staff` | Add a member of staff | Admin |
| PATCH | `/api/staff/:id` | Employment type, title, qualification, status | Admin |
| PUT | `/api/staff/:id/departments` | Which departments they belong to, and whether they head one | Admin |
| POST | `/api/staff/:id/admin` | **Grant or remove admin** | Admin |

That last one is the sharpest endpoint in the system — it is the only way
anybody's access gets wider. It records who granted it and when, removes access
by date rather than by deleting the record, and refuses to let the last
remaining admin remove their own admin rights.

## J. Admin — classes and subjects — 8

| | Address | What it does | Who |
|---|---|---|---|
| GET | `/api/classes` | List, filterable by campus, department, level, year | Any staff |
| POST | `/api/classes` | Create a cohort. Refuses a specialisation at Level 1 | Admin |
| PATCH | `/api/classes/:id` | Campus, capacity, Google group address | Admin |
| GET | `/api/classes/:id/students` | Who is in this cohort | Admin, the class's lecturers |
| GET | `/api/offerings` | Which subject is taught to which class in which term | Any staff |
| POST | `/api/offerings` | Put a subject in front of a class this term | Admin |
| DELETE | `/api/offerings/:id` | Only while nothing is attached to it yet | Admin |
| PUT | `/api/offerings/:id/teachers` | Set the lead lecturer and any assistants | Admin |

## K. Admin — enrolment — 4

| | Address | What it does | Who |
|---|---|---|---|
| POST | `/api/enrolments` | Put a student in a class **and** work out what they owe | Admin |
| GET | `/api/enrolments` | List, filterable by class, year, status | Admin |
| GET | `/api/enrolments/:id` | One enrolment with its charges and receipts | Admin, the student |
| PATCH | `/api/enrolments/:id` | Completed, withdrawn, transferred | Admin |

## L. Admin — fees — 12

**No money is ever taken here.** Fees are paid at the bursary, into the bank, or
by Mobile Money to WIPEG's own number. These endpoints record what was agreed
and what arrived.

| | Address | What it does | Who |
|---|---|---|---|
| GET | `/api/fees/schedules` | What each group is charged this year | Admin |
| POST | `/api/fees/schedules` | Set a year's fee for a department or specialisation and level | Admin |
| PATCH | `/api/fees/schedules/:id` | Change a total before anybody has enrolled against it | Admin |
| PUT | `/api/fees/schedules/:id/installments` | Replace the instalments. Refused unless they add up to the total | Admin |
| GET | `/api/enrolments/:id/charges` | What this student owes, instalment by instalment | Admin, the student |
| POST | `/api/charges/:id/waive` | Waive an instalment. A reason is required | Admin |
| GET | `/api/fees/status` | Who has paid, who has not. Filter by class, department, level | Admin |
| GET | `/api/fees/arrears` | Who to chase, worst first, with phone numbers for WhatsApp | Admin |
| POST | `/api/fees/receipts` | **Record money already received** | Admin |
| GET | `/api/fees/receipts` | The ledger. Filter by date, method, student | Admin |
| POST | `/api/fees/receipts/:id/reverse` | Cancel a receipt entered wrongly | Admin |
| GET | `/api/fees/collections` | Totals by day and method, for the cash box and the bank | Admin |

Two of these are worth a closer look.

**Recording a receipt** takes the enrolment, the receipt number from the paper
slip, the amount, how it was paid, and the date on the slip. It fills in who
keyed it from the session, never from the form. If that receipt number is
already on file it comes back saying so, instead of recording the money twice —
which is what makes the form safe to submit again on a bad connection. It
returns the new balance so the screen can show it without asking again.

**Reversing a receipt** takes only a reason. The amount is copied from the
receipt being cancelled, so a correction can never be for a different figure
than the mistake it corrects. The original is kept. Nothing in the money tables
is ever edited or deleted.

## M. Admin — catalogue and calendar — 12

The parts that change once a year.

| | Address | What it does | Who |
|---|---|---|---|
| GET | `/api/departments` | With their specialisations and heads | Any staff |
| POST | `/api/departments` | Add a department | Admin |
| PATCH | `/api/departments/:id` | Rename, reorder, deactivate | Admin |
| GET | `/api/specialisations` | Filterable by department | Any staff |
| POST | `/api/specialisations` | Add one under a department | Admin |
| PATCH | `/api/specialisations/:id` | Rename, set code, deactivate | Admin |
| GET | `/api/courses` | The subject catalogue | Any staff |
| POST | `/api/courses` | Add a subject: code, title, credit hours | Admin |
| PUT | `/api/curriculum` | Which subjects belong to which level and term | Admin |
| POST | `/api/academic-years` | Open next year, with its terms | Admin |
| POST | `/api/academic-years/:id/make-current` | Switch the current year. Only one can be current | Admin |
| GET | `/api/documents/:id/download` | A link to a scan that expires in 60 seconds | Admin, or whose document it is |

## N. Admin — reports — 5

Each of these is a ready-made view in the database, so each is one line of code.

| | Address | What it shows | Who |
|---|---|---|---|
| GET | `/api/reports/teaching-load` | Who teaches how much | Admin |
| GET | `/api/reports/students-missing-data` | Students with no matricule, date of birth or photo | Admin |
| GET | `/api/reports/fee-schedules-unbalanced` | Fee plans whose instalments do not add up | Admin |
| GET | `/api/reports/online-students` | Online students, for exam arrangements | Admin |
| GET | `/api/reports/current-students` | Everyone currently enrolled, with class and award | Admin |

The middle two should always come back empty. They are the two places the
database admits it cannot check something by itself, which is why a nightly job
reads them and complains if they are not.

## O. Google Workspace — 5

The only endpoints that talk to the outside world.

| | Address | What it does | Who |
|---|---|---|---|
| POST | `/api/google/students/:id/account` | Create the student's school email address | Admin |
| POST | `/api/google/classes/:id/group` | Create the class's Google Group for announcements | Admin |
| POST | `/api/google/offerings/:id/classroom` | Create the Google Classroom for a subject | Admin |
| POST | `/api/google/offerings/:id/sync-roster` | Make Classroom membership match the real class list | Admin, Automatic |
| GET | `/api/google/provisioning-status` | What has been created and what failed | Admin |

Every one of these can be run again safely. The database column each writes to
is unique, so a retry cannot create a second Group or a second Classroom.

## P. Automatic jobs — 4

No login. A secret key in the request, and they refuse to run for a signed-in
person who finds the address.

| | Address | What it does | How often |
|---|---|---|---|
| POST | `/api/jobs/fee-reminders` | Message students whose instalment is due or overdue | Daily, 08:00 |
| POST | `/api/jobs/provision-pending` | Retry Google Groups and Classrooms that failed | Hourly |
| POST | `/api/jobs/nightly-checks` | Read the should-be-empty reports and alert if not | Daily, 02:00 |
| POST | `/api/jobs/admissions-nudge` | Flag leads nobody has contacted in 7 days | Daily, 09:00 |

A fee reminder tells a student what they owe and where to pay it. It contains no
link that takes money, because no such link exists.

---

## The same thing from each user's side

| | Admin | Lecturer | Student |
|---|---|---|---|
| Their own details | ✓ | ✓ | ✓ |
| Their own fees | — | — | ✓ |
| Their own timetable | — | ✓ (what they teach) | ✓ |
| Upload their own documents | ✓ | ✓ | ✓ |
| See a class list | any class | only classes they teach | — |
| See another student's record | ✓ | — | — |
| See anyone's fees | ✓ | — | — |
| Record money received | ✓ | — | — |
| Change a fee schedule | ✓ | — | — |
| Enrol a student | ✓ | — | — |
| Create or change a class | ✓ | — | — |
| Assign a lecturer to a subject | ✓ | — | — |
| Work the admissions queue | ✓ | — | — |
| Take and manage booked calls | ✓ | — | — |
| Create Google accounts and Classrooms | ✓ | — | — |
| Make somebody else an admin | ✓ | — | — |

---

# PART 4 — For whoever builds it

## How the code is arranged: Models, Controllers, Routes

```
backend/
  src/
    models/        one file per table. The ONLY place SQL is written
    controllers/   one function per endpoint. Decides things; never writes SQL
    routes/        matches a web address to a controller, and says who may call it
    middleware/    sign-in, role checks, input checking, errors, rate limits
    services/      talking to Google Calendar, the Workspace directory, file storage
    jobs/          the six timed tasks
    lib/           database connection, settings, error types
    app.ts         assembles the above
    server.ts      starts it
```

The rule that keeps this honest: **a controller never writes SQL and a model
never decides anything.** If a controller contains the word `SELECT`, it is in
the wrong file. If a model contains a permission check, likewise.

A route file reads almost like English, and is the place to look when asking
"who can do this?":

```ts
router.post('/fees/receipts', requireAdmin, validate(receiptSchema), feesController.recordReceipt);
router.get ('/offerings/:id/students', requireLecturerFor('id'), offeringsController.listStudents);
router.get ('/me/fees', requireStudent, meController.fees);
router.post('/booking', rateLimit('booking'), bookingController.create);
```

**Node and Express, with plain SQL.** Not an ORM. The database already enforces
rules an ORM would hide — the Level 1 rule, the fee instalments, the
single-active-enrolment rule, one head per department. Writing the SQL by hand
in the model layer keeps those rules visible instead of generating queries that
accidentally work around them.

## Four endpoints that do more than one thing

Everything else is a single read or a single write. These four each have to
succeed completely or not at all.

**Enrolling a student** (`POST /api/enrolments`)
1. Check they have no other active enrolment
2. Create the enrolment
3. Find the fee plan for that year, department, specialisation and level
4. **Copy** each instalment onto the student as their own charge
5. Return the enrolment and the charges

Step 4 is a copy, not a lookup, on purpose: if fees rise next August, last
year's students keep the figures they agreed to. If step 3 finds no fee plan the
whole thing is refused, naming the missing plan — an enrolled student with no
charges is one nobody will ever invoice.

**Accepting a candidate** (`POST /api/admissions/:id/accept`)
Creates the person, creates the student record, marks the enquiry accepted,
records who decided and when. Guardian name and phone are required, so the
endpoint refuses and names them if the admissions desk has not collected them
yet. Seating the student in a class is a separate step, because it is usually a
different person on a different day.

**Booking a call** (`POST /api/booking`)
Creates the enquiry, creates the booking, writes the Google Calendar event,
sends the confirmation. The first two must both happen or neither does. The
calendar event is allowed to fail — a job picks it up — because Google being
slow should not lose a lead.

**Recording a receipt** (`POST /api/fees/receipts`)
Not complicated, but it has the one race that matters. Two clerks keying the
same slip at the same moment are stopped by the database's unique receipt
number, not by the code checking first and inserting after — which is exactly
the pattern that lets duplicates through when the office is busy.

## When something goes wrong

Always the same shape, so every screen can handle it the same way:

```json
{ "error": { "code": "validation_failed",
             "message": "received_on cannot be in the future",
             "field": "received_on" } }
```

| Code | Meaning in plain words |
|---|---|
| `unauthenticated` | You are not signed in, or your session expired |
| `forbidden` | You are signed in, but this is not yours to do |
| `not_found` | No such thing — also used instead of `forbidden` where even confirming it exists would leak something |
| `validation_failed` | Something in the form is wrong, and `field` says which |
| `conflict` | Already done: this receipt number exists, this student is already enrolled, this slot is taken |
| `rate_limited` | Too many attempts from the public website |
| `server_error` | Our fault. Logged with a reference number, details not shown |

## House rules, once, for all 84

- **Lists** come back as `{ "data": [...], "next_cursor": "..." }`, never a bare
  list, so filters and totals can be added later without breaking anything.
- **Long lists** are paged 50 at a time, up to 200.
- **Money** is whole francs as a plain number. No decimals — XAF has none.
- **Days** are written `2026-10-12`. **Moments** are UTC. Day boundaries in
  reports are worked out in Douala time, not the server's.
- **Phone numbers** are tidied to `+237…` before checking, so somebody typing
  `677 487 127` is helped rather than refused.
- **Nothing that counts as a record is ever deleted.** Students, enrolments,
  receipts and enquiries are closed by status. The only `DELETE` in Part 3 is on
  a subject offering nothing is attached to yet.

## What this system deliberately cannot do

| | Why |
|---|---|
| Take a payment | You asked for it out. There is no address in this system that moves money, and no column to store a card number in |
| Look a student up by phone number, publicly | A matricule is not a password. An endpoint that tells any caller "yes, this person studies here" is a privacy leak with a friendly name |
| Let somebody sign themselves up | Accounts are created by an admin after acceptance. Otherwise the student roll is editable by strangers |
| Delete a record | See above |
| Bulk-import a spreadsheet | Last year's students get loaded once, by a reviewed script, not by a permanent web address that can be pointed at the wrong file |
| Record marks or print transcripts | There is room for it and nothing blocks it, but guessing WIPEG's grading scheme would be worse than leaving the space |

## Secrets it needs

All of these live in the hosting platform's settings. None in the code, none in
the repository, none visible in a browser.

| Setting | Used for |
|---|---|
| `DATABASE_URL` | the database |
| `SUPABASE_SERVICE_ROLE_KEY` | uploading and serving documents |
| `SESSION_SECRET` | signing the sign-in session |
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` | signing in with Google |
| `GOOGLE_WORKSPACE_DOMAIN` | so only WIPEG accounts can sign in at all |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | creating accounts, Groups, Classrooms, calendar events |
| `GOOGLE_CALENDAR_ID` | the admissions calendar bookings are written to |
| `BOOKING_*` | office hours, slot length, how far ahead to offer |
| `LINK_TOKEN_SECRET` | the private links sent to visitors |
| `CRON_SECRET` | the four timed jobs |
| `TURNSTILE_SECRET_KEY` | the "not a robot" check on public forms |

The Google service account key is the most dangerous of these — it can act as
any user in the Workspace. Limit it to the two scopes the code actually
uses — `calendar.events` and `admin.directory.user` — and nothing else.

**No WhatsApp key is needed any more.** Reminders were ours to send only
because our database owned the appointment. Google Calendar owns it now and
sends its own, so the Meta Business verification and template approval are
off the list entirely.

## Known gaps

**1. The enquiry form needs two more questions.** It currently asks name, phone,
email, programme and message — and only opens an email draft rather than saving
anything. An enquiry needs a **campus** and a **level** as well. The new booking
form collects both, so building the booking form fixes this too.

**2. The testimonial form has nowhere to save.** It collects name, role,
programme, year, contact, quote and a consent tick, and also just opens an email
draft. There is no table for it yet. It needs about six columns and an "approved"
flag, plus two endpoints: one public to submit, one admin to approve.

**3. There is no audit log, and with one Admin role there should be.** Money is
already append-only and admin grants are already dated, so the two worst cases
are covered. But nothing records that a matricule changed on a Tuesday or who
changed a fee schedule. One table — who, what, which record, before, after, when
— written by the same piece of code that already wraps every write.

**4. Rate limiting needs somewhere to count.** Hosted functions forget
everything between requests, so the limits on the public forms need a small
shared store (Upstash Redis, or a table).

**Still needed from the administration**, all of which blocks real data rather
than building: the matricule format, the specialisation codes, **the full subject
list** — codes, titles, credit hours, and which specialisation and level each
belongs to, which is the biggest gap — the fee structure per specialisation and
level with instalment amounts and dates, how many semesters a WIPEG year has,
the staff list, office hours for bookings, which staff take the
reminders go to, and confirmation that Levels 1–2 = HND, 3 = Bachelor,
4–5 = Master in every department.

## Build order

`prompt.md` in the project root breaks this into **12 steps**, each one small
enough to check before starting the next. In summary:

| Step | What | Why here |
|---|---|---|
| 1 | Create the Supabase project, load the schema, seed real campuses and departments | Everything needs a database |
| 2 | Backend skeleton: folders, connection, settings, errors | The files every other step imports |
| 3 | Sign in with Google, and `/api/me` | Nothing can be protected until someone can sign in |
| 4 | Role checks and input checking | Written once, correctly, rather than 84 times |
| 5 | Public catalogue and the enquiry form | The first thing with a real user waiting |
| 6 | **Call booking**, with Google Calendar | The new piece. Needs steps 4 and 5 underneath it |
| 7 | The admissions desk and the call diary | Makes steps 5 and 6 worth something |
| 8 | Catalogue, calendar, classes and subjects | Needed before anyone can be enrolled |
| 9 | Enrolment, with the copy-the-charges transaction | The spine of the whole system |
| 10 | Fees | Charges hang off enrolments, so this comes after |
| 11 | Student and lecturer self-service | All reads. Nothing new underneath |
| 12 | The timed jobs and Google Classroom provisioning | Background work, easiest last |

Steps 1 to 4 are about a day. Step 9 is the one to review carefully.
