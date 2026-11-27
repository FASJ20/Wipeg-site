# Automating Google Classroom

Creating a Classroom for every subject, and putting the right students and
lecturers in it, without anybody typing a name twice.

Set up once (about 20 minutes), then it runs hourly on its own.

---

## 1. What actually gets created

**One Classroom per `course_offerings` row** — one subject, taught to one
class, in one term.

Not one per class. A Level 2 Software Engineering cohort takes six subjects
with six different lecturers; those are six Classrooms, which is how teachers
and students expect Classroom to work.

So a Classroom comes out looking like:

| Field | Value | From |
|---|---|---|
| Name | *Software Engineering — Level 2 Software Engineering — Garoua* | `courses.title` + the class |
| Section | *Level 2 Software Engineering — Garoua* | level, specialisation, campus |
| Heading | *CEN201* | `courses.code` |
| Room | *First semester 2026/27* | term + academic year |
| Teachers | whoever is in `teaching_assignments` | |
| Students | everyone with an **active enrolment** in that class | |

At Level 1 there is no specialisation — that is the department-wide rule — so
the label falls back to the department name, which is what a Level 1 student
would expect to read.

---

## 2. The four Google rules this is built around

Worth reading before the setup, because each one is a day lost if you meet it
by surprise.

**A domain administrator can add people directly, with no invitation.** Google
documents this: an admin bypasses the invitation flow as long as the person
being added *and* the course owner are both inside your domain. That is the
whole reason no student ever has to accept anything — and the reason the
service account has to act as an admin, not as a lecturer.

**A new course is invisible by default.** Create one without saying otherwise
and its state is `PROVISIONED`, which students cannot see. The code sets
`courseState: "ACTIVE"` explicitly on every create.

**A course can be created with an alias as its id.** That is the entire
idempotency story. Each offering gets `d:wipeg-offering-<uuid>`, derived from
its database id, so asking twice finds the same Classroom instead of making a
second one. It also means the link survives restoring the database from a
backup with `google_course_id` empty.

**Adding somebody already on the roster returns `ALREADY_EXISTS`.** The code
treats that as success. A sync that cannot be re-run is useless, and this is
what makes re-running free.

---

## 3. Set-up, once

You need the service account from [api-keys.md](api-keys.md) §5 already
created. This adds Classroom to it.

### Step 1 — Turn the Classroom API on

[console.cloud.google.com](https://console.cloud.google.com), your
`wipeg-backend` project → **APIs & Services → Library** → search **Google
Classroom API** → **Enable**.

Without this every call returns 403 with `@ClassroomApiDisabled`, which reads
like a permissions problem and is not one.

### Step 2 — Add the two Classroom scopes to the delegation

[admin.google.com](https://admin.google.com) → **Security → Access and data
control → API controls → Manage Domain Wide Delegation**.

Find the entry for your service account's client ID and **edit** it. The scope
list must now contain **four** entries in total:

```
https://www.googleapis.com/auth/calendar.events,
https://www.googleapis.com/auth/admin.directory.user,
https://www.googleapis.com/auth/classroom.courses,
https://www.googleapis.com/auth/classroom.rosters
```

A scope missing here does not error at setup. The access token simply comes
back without it and every Classroom call 403s later, which is a confusing way
to find out.

### Step 3 — Confirm the impersonated account is a super admin

`GOOGLE_IMPERSONATED_ADMIN` in `backend/.env` must be a **super administrator**
on `wipeg.online`. A user with a custom admin role carrying Classroom
permissions is reported in the forums to still get 403 here; a super admin is
the configuration Google documents.

That account also ends up owning every Classroom the sync creates. See §5 for
why, and how to change it if WIPEG would rather lecturers owned theirs.

### Step 4 — Turn Classroom on for both org units

Admin console → **Apps → Google Workspace → Classroom** → make sure the
service is **ON** for `/Students` and `/Staff`.

Then, in the same place, open **Teacher permissions** (Google has moved and
renamed this more than once, so look for the section about who can create
classes) and make sure your lecturers are treated as teachers. In Workspace
for Education that normally means being in the **Classroom Teachers** group.

A lecturer who is not a verified teacher can still be *added* to a course by
an admin, but cannot create one — which is fine here, because the backend
never asks them to.

### Step 5 — Make sure the students have accounts

A Classroom roster is keyed on a Google account. A student with no
`@wipeg.online` address cannot be added at all.

That is already handled: accounts are created at enrolment by
`ensureWorkspaceAccount` (see [backend/README.md](../backend/README.md)).
Students who do not have one yet are **counted and skipped**, never failed,
and the next run picks them up. The sync report tells you how many are
waiting.

---

## 4. Prove it works before you trust it

Do not run this over 200 offerings first. Run it over one.

```powershell
curl.exe -X POST http://localhost:6008/api/classroom/sync -H "content-type: application/json" -d '{\"offeringId\":\"<one-offering-uuid>\"}' --cookie "wipeg_session=<your session>"
```

You get a report back:

```json
{ "data": {
  "offeringsConsidered": 1,
  "coursesCreated": 1,
  "studentsAdded": 37,
  "teachersAdded": 2,
  "studentsWaitingForAnAccount": 3,
  "failures": [],
  "problems": []
} }
```

Then open [classroom.google.com](https://classroom.google.com) as the admin
and check: the class is there, it is **active** (not greyed out), the lecturer
is listed as a teacher, and the students are on the roster **without** a
pending invitation.

**Now run the exact same command again.** The second report should say
`coursesCreated: 0`, `studentsAdded: 0` and no failures. That is the proof
that the hourly job is safe — if the second run creates a duplicate, stop and
tell me rather than scheduling it.

---

## 5. Running it for real

Two doors onto the same function, which matters: one button and one job that
behave differently is a bug generator.

| | Who | When |
|---|---|---|
| `POST /api/classroom/sync` | Admin, signed in | Pressed after enrolling somebody, when you don't want to wait |
| `POST /api/jobs/classroom-sync` | The scheduler, with `CRON_SECRET` | Hourly |

Both accept an optional `offeringId` to do one, and a `limit` as a safety
valve. The job endpoint refuses a request that also carries a session cookie,
so a signed-in browser cannot trigger it by stumbling on the address.

Every run writes one line to the audit log with the counts, so "when did these
students get added and by whom" is answerable later.

### Who owns the courses

The impersonated admin, not the lecturer — deliberately.

A create fails outright if the named owner cannot own a course: no Classroom
access, licence not assigned, account not yet verified as a teacher. A
lecturer hired last week is exactly who that happens to, and it would fail the
whole class's Classroom for a reason nobody can see from here.

The admin can always own one. The lecturer is added as a teacher a moment
later with every right that matters — post, grade, mark, invite — and
ownership can be transferred in the Classroom UI whenever WIPEG wants.

---

## 6. What it deliberately does not do

**It never removes anybody.** Additive only. A student who withdraws is taken
out of the Classroom by a human.

That is a real decision, not an oversight: an automated removal fired by a
mis-keyed status would delete that student's submitted work, and nothing this
job saves is worth that risk. Removals are rare and reversible by hand;
deleted coursework is neither.

**It does not create coursework, post announcements or touch grades.** The
scopes it holds cannot do any of those, which is the point of keeping them to
two.

**It does not create a Classroom for an empty offering.** An offering with no
students and no lecturers yet is skipped rather than turned into an empty
shell somebody has to tidy up.

---

## 7. When it goes wrong

| What you see | What it means |
|---|---|
| 403 `@ClassroomApiDisabled` | Step 1. The API is not enabled in the Cloud project |
| 403 on every call, API enabled | Step 2. A scope is missing from the delegation entry — compare all four, character for character |
| 403 only on create | Step 3. The impersonated account is not a super admin |
| `UserCannotOwnCourse` | The owner account cannot own courses. Check the admin's own Classroom access |
| 404 adding one student | That address has no Google account. The report names it under `problems` |
| `studentsWaitingForAnAccount` above zero | Those students have no `school_email` yet. Provisioning, not Classroom |
| Students see nothing | The course is `PROVISIONED`. Should not happen — the code sets ACTIVE — but check in the Classroom UI |

A single bad address never abandons the rest of the class: it is collected
into `problems` and the other students still go in.

---

## 8. Quotas

Google does not document a figure on the pages covering these methods, and I
am not going to invent one. What the code does instead: adds people **one at a
time, in order**, rather than firing forty requests at once. For an hourly job
over a few hundred students that is quick enough, and it keeps the failure
report readable.

If WIPEG ever grows into a quota wall, the Classroom API quota is visible and
raisable in the Cloud console under **APIs & Services → Quotas**.

---

## Checklist

```
[ ] 1. Google Classroom API enabled in the Cloud project
[ ] 2. All FOUR scopes on the domain-wide delegation entry
[ ] 3. GOOGLE_IMPERSONATED_ADMIN is a super administrator
[ ] 4. Classroom ON for /Students and /Staff; lecturers are verified teachers
[ ] 5. Students have @wipeg.online accounts (automatic, at enrolment)
[ ] 6. Smoke test on ONE offering, checked in the Classroom UI
[ ] 7. Same command run twice — second run creates nothing
[ ] 8. Hourly schedule pointed at /api/jobs/classroom-sync with CRON_SECRET
```

---

## Sources

- [Create and manage teachers and students](https://developers.google.com/workspace/classroom/guides/manage-users) — the admin bypass of the invitation flow
- [Method: courses.create](https://developers.google.com/workspace/classroom/reference/rest/v1/courses/create) — `ownerId` rules, `PROVISIONED` default, error codes
- [Method: courses.students.create](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.students/create) — required scopes, direct add within a domain
- [Domain-wide delegation (Classroom)](https://developers.google.com/workspace/classroom/guides/key-concepts/domain-wide-delegation) — the service-account route
- [Manage course aliases](https://developers.google.com/workspace/classroom/guides/manage-aliases) — `d:` domain-scoped aliases
