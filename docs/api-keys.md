# Every key the backend needs, and how to get it

Six things. Two you generate yourself in ten seconds, three come from Google,
one from Supabase. One optional extra at the end.

Nothing here goes in the repository. They live in `backend/.env` while you are
working locally, and in the hosting platform's environment variables in
production. `backend/.env` is git-ignored and must stay that way.

**One that is no longer needed:** the WhatsApp Cloud API. Reminders used to be
ours to send because our database owned the appointment. Google Calendar owns
it now and sends its own reminders, so the Meta Business verification and the
template approval — which take days and were going to be the thing blocking
go-live — are off the list entirely.

---

## 1. `DATABASE_URL` — Supabase

**What it is:** the PostgreSQL connection string, password included. The single
most sensitive value in the file.

1. [supabase.com](https://supabase.com) → New project.
2. Name it `wipeg`, region **West EU (London)** or **Frankfurt** — closest of
   the available regions to Cameroon.
3. Set a database password and put it straight in a password manager. Supabase
   shows it once.
4. Project Settings → Database → Connection string → **URI**.
5. Paste into `DATABASE_URL`. Replace `[YOUR-PASSWORD]` with the real one.

Use the **pooled** connection (port 6543) when the API is deployed to a
serverless host, and the direct one (5432) locally.

> Do not touch the existing `N8N` project. This is a new one.

**Then apply the schema:** Supabase → SQL Editor → paste `db/schema.sql` → Run.
It is one transaction; it either all lands or none of it does.

---

## 2. `SESSION_SECRET` — you generate it

**What it is:** the key that signs session cookies. Anyone holding it can forge
a session as any user, including an admin.

```powershell
openssl rand -base64 48
```

Changing it signs everybody out, which is the correct response to a suspected
leak. There is no other revocation.

---

## 3. `CRON_SECRET` — you generate it

**What it is:** the shared secret the scheduler sends so job endpoints know the
caller is the scheduler and not a browser.

```powershell
openssl rand -base64 32
```

---

## 4. `GOOGLE_OAUTH_CLIENT_ID` and `..._SECRET` — Google Cloud

**What it is:** lets people sign in with their `@wipeg.online` account. There
are no passwords in this system, so this is the whole login.

1. [console.cloud.google.com](https://console.cloud.google.com) — sign in as
   **admin@wipeg.online**, not a personal account. The project must belong to
   the Workspace.
2. New project, `wipeg-backend`.
3. APIs & Services → OAuth consent screen → **Internal**.
   Internal matters twice over: only Workspace accounts can use it, and Google
   skips the app-verification review that takes weeks for External.
4. Credentials → Create credentials → **OAuth client ID** → Web application.
5. Authorised redirect URIs — add both:
   ```
   http://localhost:6008/api/auth/google/callback
   https://api.wipeg.online/api/auth/google/callback
   ```
   (adjust the second once you know the production API hostname)
6. Copy the client ID and client secret into `.env`.

---

## 5. `GOOGLE_SERVICE_ACCOUNT_JSON` — Google Cloud + Admin console

**What it is:** the credential that lets the backend write to the calendar and
create student accounts without a human signing in.

**Treat it as a master key.** With domain-wide delegation it can act as any
user in the Workspace. It is why the two scopes below are narrow and why the
code never logs it.

### a. Create it

1. Same Cloud project → IAM & Admin → Service Accounts → Create.
2. Name `wipeg-backend`. No project roles needed — its power comes from the
   Workspace side, not from Google Cloud.
3. Open it → Keys → Add key → **Create new key** → JSON. It downloads once.
4. Note the **Unique ID** (a long number) on the service account's details
   page. You need it in the next step.
5. Enable both APIs: APIs & Services → Library → enable **Google Calendar API**
   and **Admin SDK API**.

### b. Give it permission to act in the Workspace

1. [admin.google.com](https://admin.google.com) → Security → Access and data
   control → **API controls** → Manage Domain Wide Delegation.
2. Add new. Client ID = the Unique ID from step a.4.
3. OAuth scopes — exactly these two, comma-separated, and nothing more:
   ```
   https://www.googleapis.com/auth/calendar.events,
   https://www.googleapis.com/auth/admin.directory.user
   ```

### c. Put it in `.env`

The whole JSON file, on **one line**:

```powershell
(Get-Content .\wipeg-backend-xxxx.json -Raw) -replace "`r`n","" -replace "`n",""
```

Paste the result as `GOOGLE_SERVICE_ACCOUNT_JSON=...`, then **delete the
downloaded file**. Also set:

```
GOOGLE_IMPERSONATED_ADMIN=admin@wipeg.online
```

The service account acts as this person. Google refuses the directory API to a
service account that is not impersonating a real admin.

### d. Create the two organisational units

Admin console → Directory → Organisational units. Create `Students` and
`Staff`. Account creation fails if the OU in `.env` does not exist.

---

## 6. `GOOGLE_CALENDAR_ID` — Google Calendar

**What it is:** the calendar that booked calls are written to, and read back
out of to work out which slots are free.

1. [calendar.google.com](https://calendar.google.com) as **admin@wipeg.online**.
2. Create a new calendar: **WIPEG — Admissions calls**.
   Not a staff member's own calendar. Their dentist appointment should not
   decide whether a prospective student can book, and this has to survive them
   leaving.
3. Settings for that calendar → share it with the admissions staff who will
   take the calls, as **Make changes to events**.
4. Also share it with the **service account's email address** (the
   `client_email` in the JSON, ending `.iam.gserviceaccount.com`), as **Make
   changes to events**.
5. Scroll to **Integrate calendar** → copy the **Calendar ID** into
   `GOOGLE_CALENDAR_ID`.

Step 4 is the one people miss. Without it every booking fails with a 404 that
reads like the calendar does not exist.

---

## Optional: `TURNSTILE_SECRET_KEY` — Cloudflare

**What it is:** the "not a robot" check on the public booking form.

The backend already rate-limits booking to five per hour per IP, which handles
casual abuse. Turnstile is worth adding when the form is live and attracting
real spam, not before.

[dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile → Add site →
copy the **secret** key (the site key goes in the frontend).

---

## Checklist

```
[ ] 1. Supabase project created, schema applied, DATABASE_URL set
[ ] 2. SESSION_SECRET generated
[ ] 3. CRON_SECRET generated
[ ] 4. OAuth client created (consent screen = Internal), both URIs added
[ ] 5. Service account created, 2 APIs enabled, delegation granted, JSON in .env
[ ] 5b. /Students and /Staff organisational units created
[ ] 6. Shared calendar created, shared with staff AND the service account
[ ] 7. Downloaded JSON key file deleted from the laptop
```

Once 1–3 are done the server starts and the catalogue endpoints work. 4 adds
sign-in. 5 and 6 add booking and account creation.

---

## What each one unlocks

| Missing | What stops working |
|---|---|
| `DATABASE_URL` | everything — the server refuses to start |
| `SESSION_SECRET` | everything — the server refuses to start |
| OAuth client | signing in; public catalogue still works |
| Service account | booking and account creation |
| `GOOGLE_CALENDAR_ID` | booking only |
| `CRON_SECRET` | the timed jobs |
