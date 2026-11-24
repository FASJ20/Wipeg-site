# WIPEG backend

The API behind the WIPEG website and the staff tools. Nothing is built yet —
this folder holds the structure and the plan.

**Read first:** `../prompt.md` — the build, broken into 12 steps you give to
Claude Code one at a time. Do not skip to step 5.

**The contract:** `../db/API.md` — all 102 endpoints and who may call each one.
**The database:** `../db/schema.sql` — 26 tables, 12 views, already written and
tested. The backend does not create tables; it reads and writes the ones there.

---

## Architecture: Models, Controllers, Routes

```
src/
  models/        one file per table — the ONLY place SQL is written
  controllers/   one function per endpoint — decides things, never writes SQL
  routes/        maps a web address to a controller, and declares who may call it
  middleware/    sign-in, role checks, input validation, errors, rate limits
  services/      the outside world: Google Calendar, Classroom, WhatsApp, storage
  jobs/          the six timed tasks
  lib/           database pool, settings, error types, logger
  app.ts         assembles all of the above into an Express app
  server.ts      starts it listening
tests/
```

Two rules keep the layers honest, and both are easy to check in review:

1. **A controller contains no SQL.** If the word `SELECT` appears in
   `controllers/`, the query belongs in a model.
2. **A model contains no permission logic and no HTTP.** It takes arguments,
   returns rows, and throws typed errors. It never sees a request or a session.

Routes are the single place to answer "who can do this?":

```ts
router.post('/fees/receipts',        requireAdmin,              validate(receiptSchema), fees.recordReceipt);
router.get ('/offerings/:id/students', requireLecturerFor('id'),                          offerings.listStudents);
router.get ('/me/fees',              requireStudent,                                      me.fees);
router.post('/booking',              rateLimit('booking'),      validate(bookingSchema),  booking.create);
router.post('/jobs/appointment-reminders', requireCronSecret,                             jobs.appointmentReminders);
```

## The three users

| Role | How the system knows | Reach |
|---|---|---|
| **Admin** | a `staff` row **and** a live `admin` grant in `staff_roles` | everything |
| **Lecturer** | a `staff` row | only the offerings they are assigned to teach |
| **Student** | a `students` row | their own record only |

Plus three callers who are not users: unauthenticated website visitors, holders
of a signed link (people who booked a call or sent an enquiry), and the timed
jobs, which carry `CRON_SECRET` and no session.

## Stack

| Choice | Why |
|---|---|
| Node 20+, TypeScript, Express 5 | MCR maps onto it directly, and it is the least surprising thing to hand to another developer in Cameroon |
| `pg` (node-postgres), plain SQL | The database already enforces the Level 1 rule, single-active-enrolment, one-head-per-department and the fee instalment rules. An ORM would hide them and sometimes generate queries around them |
| `zod` | One schema per endpoint, checked before anything reaches the database |
| `vitest` | Tests, including against a throwaway Postgres as `db/test_rules.py` already does |

**No ORM, no migrations in this folder.** The schema lives in `db/schema.sql`
and changes there, as reviewed SQL. The backend never alters a table.

## Running it

Nothing to run yet. Once step 2 of `../prompt.md` is done:

```powershell
cd backend; npm install; npm run dev
```

Copy `.env.example` to `.env` and fill it in. `.env` is git-ignored and must
stay that way — it holds the database password, the Google service-account key
and the WhatsApp token.
