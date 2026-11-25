# WIPEG backend

The API behind the WIPEG website and the staff tools.

**Working now:** health, Google sign-in, `/api/me`, the public catalogue, call
booking onto Google Calendar, Workspace account provisioning, and the audit
log. Enrolment, fees, results and documents are not built yet.

| | |
|---|---|
| The contract | [`../db/API.md`](../db/API.md) |
| The database | [`../db/schema.sql`](../db/schema.sql) — 24 tables, 8 views, already written and tested |
| The build order | [`../prompt.md`](../prompt.md) |
| The keys | [`../docs/api-keys.md`](../docs/api-keys.md) |

The backend does not create tables. The schema lives in `db/schema.sql` and
changes there, as reviewed SQL.

---

## Running it

```powershell
cd backend; npm install
```

Copy `.env.example` to `.env` and fill in at least `DATABASE_URL` and
`SESSION_SECRET` — the server refuses to start without them, by design, and
tells you which one is missing. Everything else is optional until you use the
feature that needs it.

```powershell
cd backend; npm run dev
```

Listens on **6008**. The website is 6007. Neither is ever 3000.

```powershell
curl http://localhost:6008/api/health
```

Other scripts: `npm run typecheck`, `npm run build`, `npm test`.

---

## Architecture: Models, Controllers, Routes

```
src/
  models/        one file per table — the ONLY place SQL is written
  controllers/   one function per endpoint — decides things, never writes SQL
  routes/        maps a web address to a controller, and declares who may call it
  middleware/    sign-in, role guards, validation, errors, rate limits
  services/      the outside world: Google OAuth, Calendar, Directory
  lib/           config, database pool, errors, logger, sessions, HTTP helpers
  app.ts         assembles all of the above
  server.ts      starts it listening
```

Two rules keep the layers honest, and both are checkable by eye in review:

1. **A controller contains no SQL.** If `SELECT` appears in `controllers/`,
   the query belongs in a model.
2. **A model contains no permission logic and no HTTP.** It takes arguments,
   returns rows, throws typed errors. It never sees a request or a session.

`routes/index.ts` is the single place that answers "who can call this?". The
guard always comes before the validator, and the validator before the
controller — an unauthorised caller is refused before the server spends
anything parsing what they sent.

### ESM, so imports carry `.js`

The project is `"type": "module"` with `moduleResolution: NodeNext`. Relative
imports are written `./thing.js` even though the file is `thing.ts`. That is
correct and required; it is what Node will actually resolve after the build.

---

## The three users

| Role | How the system knows | Reach |
|---|---|---|
| **Admin** | a `staff` row **and** a live `admin` grant in `staff_roles` | everything |
| **Lecturer** | a `staff` row | the offerings they are assigned to teach |
| **Student** | a `students` row | their own record only |

Being a lecturer is not granted — it is what a staff row means. `admin` is the
only value `staff_roles.role` allows, and only an existing admin can grant it.

Roles are read from the database on **every** request, not cached in the
cookie. One indexed query, and revoking an admin grant takes effect on their
next click rather than whenever their cookie happens to expire.

Plus two callers who are not users: unauthenticated website visitors (the
catalogue and booking), and the timed jobs, which carry `CRON_SECRET` and no
session. A request carrying both is refused.

---

## Two things worth knowing before you change anything

### Booking is not in this database

There is no appointments table. Google Calendar **is** the booking system:
`services/google/calendar.ts` reads free/busy out of the shared WIPEG calendar
to offer slots, and writes the event into it when somebody books. Only one
audit line touches Postgres.

The reason is operational. Staff already have Calendar on their phones; if a
call has to move they move it there and it is moved. No second system, nothing
to reconcile.

The cost, stated plainly: WIPEG cannot report on bookings with SQL, and if
Google is down nobody can book. Both are fine for a handful of calls a day. If
booking volume ever justifies reporting, copy events into a table for
*reading* — do not make Postgres the source of truth again.

### Accounts are created at enrolment, not at sign-in

An account cannot be created when somebody signs in, because signing in with
Google requires the account to already exist. So `ensureWorkspaceAccount` runs
at the moment WIPEG first commits to a person — enrolment for a student, being
added to staff for a lecturer — and by their first sign-in the address is
waiting. From the registry's side the effect is the one asked for: nobody
types a name into the Admin console twice.

`WORKSPACE_EMAIL_FORMAT` decides what the address looks like. **Decide it
once**: changing it later renames nobody, so WIPEG ends up with two naming
schemes side by side.

---

## Stack

| Choice | Why |
|---|---|
| Node 20+, TypeScript strict, Express 5 | MCR maps onto it directly, and it is the least surprising thing to hand to another developer |
| `pg`, plain parameterised SQL | The database already enforces the Level 1 rule, single-active-enrolment, one-head-per-department and the fee instalment rules. An ORM would hide them and sometimes generate queries around them |
| `zod` | One schema per endpoint, checked before anything reaches a model |
| `google-auth-library` + `fetch` | Rather than `googleapis`, which is tens of megabytes for the handful of calls used here. The request bodies are easier to audit when they are visible |
| `vitest` | Tests, including against a throwaway Postgres as `db/test_rules.py` already does |

No ORM. No migrations in this folder.
