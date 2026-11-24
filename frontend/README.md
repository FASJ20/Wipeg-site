# WIPEG frontend

**Empty on purpose. Nothing has moved here yet.**

The live website is still at the repository root — `src/app`, `src/components`,
`src/data` — and is deployed from there to Vercel. Do not move it until the
backend exists, or the site goes down for no gain.

## What belongs here, later

When the backend from `../prompt.md` is working, this folder takes over:

| | |
|---|---|
| **The public website** | the marketing pages as they are today, with two forms wired to the API instead of opening an email draft: the enquiry form, and the new **book a call** form |
| **The student portal** | timetable, subjects, fees, documents. All reads except document upload |
| **The lecturer pages** | the classes they teach and the class lists |
| **The admin tools** | the admissions queue, the call diary, student records, enrolment, fees, reports |

## Two things to decide before moving anything

**1. One app or two?** The admin tools and the public marketing site have
almost nothing in common — different audiences, different look, different
caching. They can be one Next.js app with a protected route group, or two
deployments sharing the design tokens. One app is less to run; two means a
mistake in the admin area cannot take the public site down.

**2. The public site must stay fast and static.** It is the only part a
prospective student ever sees, often on a slow connection. The pages that sell
WIPEG should keep being prerendered; only the booking widget and the two forms
need to talk to the API.

## When it does move

- The live site keeps working throughout. Move it in one commit, with the
  Vercel project's root directory changed in the same deploy.
- `src/data/site.ts` holds the real campuses, departments and specialisations,
  and is currently the only source for them. Once the backend serves
  `/api/catalogue`, that file becomes the seed data, not the source of truth —
  but keep it until the seeding is done and verified.
- The site is `noindex` until the placeholder content is replaced.
  `NEXT_PUBLIC_ALLOW_INDEXING=true` is what lifts it. That has not changed.
- Dev server runs on port **6007**, never 3000. The backend takes 6008.
