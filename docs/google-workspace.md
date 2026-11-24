# Getting WIPEG onto Google Workspace for Education

Everything in this project that touches Google — staff sign-in, the booking
calendar, Classroom provisioning, student email addresses — depends on WIPEG
owning a Workspace on its own domain. This file is the route there.

Read it in order. The sequence matters more than the individual steps: one of
them is hard to undo, and two of them will make the application fail if done
too early.

---

## 1. The honest part: will WIPEG qualify?

Education Fundamentals is **free** — no per-student cost, ever — which is why
it is worth the paperwork. But Google does not hand it out on request. The
published test has four parts, and WIPEG passes two of them cleanly, one
probably, and one needs work:

| Google's requirement | Where WIPEG stands |
|---|---|
| Government-recognised and **accredited** | OK, if the MINESUP authorisation exists — see §2 |
| Higher education must **grant degrees** | The risk. See below |
| An **active website** about the institution | Not yet. See §4 |
| The applicant must **belong to the institution** | OK — apply from a WIPEG address, not a personal one |

**The degree-granting wrinkle.** Google says higher-education applicants must
award degrees. In Cameroon the HND is awarded by MINESUP, under Ministerial
Order 02/0069/MINESUP/DDES — the institute is *authorised to prepare students
for it*, which is not quite the same sentence. WIPEG also lists Bachelor and
Master awards, and those help the case considerably.

The way to handle this is not to argue the distinction. It is to lead the
application with the ministerial authorisation document, describe WIPEG as an
accredited higher education institution offering HND, Bachelor and Master
programmes, and let the authorisation number do the talking. Reviewers are
looking for government recognition, and a MINESUP *Agrement Ministeriel*
number is exactly that.

**What would sink it:** applying while the site still reads as a marketing page
for a training company. Google explicitly excludes "for-profit education
companies" and employee training programmes. A fee-paying private institute is
not what that clause is aimed at, but a reviewer with nothing to go on but a
placeholder website may not know the difference. Fix the website first (§4).

---

## 2. Get the document before anything else

Ask the administration for a **scanned PDF of the MINESUP ministerial
authorisation** — the *Arrete* or *Agrement Ministeriel*, the one carrying a
number and a date in roughly this form:

```
19-10903/L/MINESUP/SG/DDES/ESUP/SDA/OAGS
```

Three things to confirm while asking:

1. The authorisation is current, not lapsed.
2. **HND is named on it** — not only BTS, DQP or CQP. Google will read the
   document; so should we.
3. The programmes WIPEG actually runs are the programmes the authorisation
   covers. MINESUP has publicly warned about institutions running programmes
   beyond their approval, and an authorisation that does not match the website
   is worse than none.

If WIPEG is authorised under MINEFOP (vocational training) rather than MINESUP
(higher education), say so before applying — it changes how the application
should be written, and it weakens the degree-granting argument enough that the
paid route in §5 becomes the sensible first move.

**Nothing below this line should happen until that PDF is in hand.**

---

## 3. The domain: `wipeg.online`

Registered at Hostinger. Now set in the code in three places:

```
src/app/layout.tsx:20   metadataBase   https://wipeg.online
src/app/sitemap.ts:7    SITE_URL       https://wipeg.online
src/data/site.ts:36     website        wipeg.online
```

`school.email` in `src/data/site.ts` is deliberately **still**
`wipeggaroua@gmail.com`. It stays there until a Workspace mailbox actually
exists — putting `info@wipeg.online` on a live contact page before that
address can receive mail would quietly lose real enquiries.

### Is `.online` a problem?

Less than it looks, but it is worth being precise, because every student and
staff address will be `name@wipeg.online`.

**Deliverability: not really.** Spamhaus is explicit that filtering is not
driven by the domain ending — sender reputation is what matters. The genuine
risk here applies to *any* newly registered domain in *any* TLD: most
spam-protection services treat a domain with suspicion for roughly its first
30 days. That is a scheduling fact rather than a TLD fact, and §7 says what to
do about it.

**Perception: a little.** `wipeg.online` reads less institutional than
`wipeg.cm` would, both to a prospective student and to whoever reviews the
Education application. Not disqualifying — the MINESUP authorisation carries
far more weight — but not help either.

**It is revisitable, which is the part worth knowing.** Google Workspace takes
multiple domains and domain aliases at no extra cost. If WIPEG later buys
`wipeg.cm`, it can be added as a secondary domain: new accounts get
`@wipeg.cm`, existing accounts gain it as a second address, and mail to both
keeps working.

What is *awkward* rather than impossible is promoting that second domain to
primary. Google does support the switch, but it does not rename anybody — each
account's address has to be changed afterwards, by hand or in bulk — and at
least one guide claims Education editions cannot change primary domain at all
(that claim is about three years old, so it needs checking against the current
rules if it ever matters).

So the working assumption: `wipeg.online` is the permanent **account** domain,
and any future `wipeg.cm` is a pretty **public** domain layered over it. That
is a perfectly normal arrangement and not a compromise worth paying to avoid.

---

## 4. Point the domain at the live site — do this before applying

Google requires an active website about the institution, and the review is done
by a person who will open it. Today the site is on `wipeg-site.vercel.app`
with `noindex` and placeholder copy, which is not an application-winning first
impression.

So: domain first, application second.

### 4a. Add the domain in Vercel

Vercel project, Settings, Domains, add the domain. Vercel then shows the
**exact** A record (apex) and CNAME (`www`) values to use. Use the values it
prints — Vercel's anycast IP has changed before, and any IP written down in a
guide goes stale.

### 4b. Add those records at Hostinger — and keep DNS at Hostinger

Hostinger panel, Domains, DNS / Nameservers, **DNS records**.

> **Do not move the domain to Vercel's nameservers.** It is the one mistake
> here that is genuinely painful. Vercel's DNS is built for websites; if the
> nameservers move there, every mail record has to be rebuilt in Vercel, and a
> missing MX record means mail silently bounces rather than failing loudly.
> Keeping DNS at Hostinger lets the website point at Vercel while mail points
> at Google, which is what we want.

| Type | Name | Value | Note |
|---|---|---|---|
| A | `@` | *(the IP Vercel shows)* | the apex domain |
| CNAME | `www` | *(the target Vercel shows)* | usually `cname.vercel-dns.com` |

Delete any **parking** A record or CNAME that Hostinger added at `@` or `www`
when the domain was bought, or it will fight the new one.

### 4c. Make the site presentable

The site is `noindex` until `NEXT_PUBLIC_ALLOW_INDEXING=true`, and that gate
should stay closed until the placeholder content is replaced. For the
application, the page a reviewer lands on needs to read unmistakably as a
school: the programmes, the campus, and the MINESUP authorisation number in the
footer. That last one is worth adding regardless — it is exactly what
prospective students in Cameroon are told to look for.

---

## 5. The decision: apply free, or pay to start now

The Education application takes **up to 14 business days** and can be refused.
Meanwhile steps 3, 6 and 12 of [prompt.md](../prompt.md) — Google sign-in, the
booking calendar, Classroom provisioning — cannot be built or tested without a
Workspace. Three weeks of backend work would be blocked on a reviewer.

There is no need to choose one.

| | Education Fundamentals | Business Starter |
|---|---|---|
| Cost | Free, unlimited accounts | roughly $7–8 per user per month (verify current pricing) |
| Starts | up to 14 business days, may be refused | immediately, no review |
| Storage | 100 TB pooled across the institution | 30 GB per user |
| Classroom | Yes | No |
| Needs accreditation proof | Yes | No |

**Recommendation: take one Business Starter seat today on the real domain —
`admin@<domain>` — and apply for Education Fundamentals in parallel.**

That single seat is enough to build and test all of the Google work: the OAuth
client, the `hd=` domain pin, the service account, the booking calendar. It
costs about the price of a coffee per month while the review runs. And Google's
own route to Education approval is "sign up **or upgrade your existing
subscription**", so the same domain, the same admin account and the same OAuth
client carry straight over when Fundamentals is granted. Nothing is rebuilt and
nothing is thrown away.

If Education is refused, WIPEG is not stuck: there is a working Workspace, and
the appeal goes in with a better website and a cleaner authorisation document.

Classroom is the one thing Business Starter cannot do, and Classroom is step
12 — the last step. By the time it matters the review will be long settled.

---

## 6. Doing the sign-up

1. Go to the Google Workspace for Education sign-up page.
2. Choose **"I have a domain"** and enter it. Do not let Google sell a new
   one — it is already registered at Hostinger.
3. Create the first admin, `admin@<domain>`. Use a strong unique password, kept
   in a password manager — not in a notebook and never in this repository. Turn
   on 2-step verification on this account the same day: it can create and
   delete every other account at WIPEG.
4. **Verify the domain** with the TXT record Google provides, added at
   Hostinger alongside the A and CNAME from §4b:

   | Type | Name | Value |
   |---|---|---|
   | TXT | `@` | `google-site-verification=...` |

   Hostinger usually publishes this within minutes; Google can take up to an
   hour to see it. Verification has to finish before the application is
   reviewed at all.
5. Upload the MINESUP PDF when asked for proof of educational status, and
   apply from the `@<domain>` address — not from `wipeggaroua@gmail.com`.
   Google wants the applicant to visibly belong to the institution.

---

## 7. Mail records — the part that breaks quietly

Only once the Workspace exists. Adding MX records before there are mailboxes
means mail is accepted and then dropped.

The Admin console's Gmail setup wizard prints the records to add. Current
Google guidance is a single MX record:

| Type | Name | Priority | Value |
|---|---|---|---|
| MX | `@` | 1 | `smtp.google.com` |

Older guides list five `ASPMX.L.GOOGLE.COM` records. Use whatever the console
shows, and **delete Hostinger's default MX records first** — Hostinger adds its
own mail records on registration, and leaving them alongside Google's means
some mail goes to a mailbox nobody reads.

Then three records that are not optional. Mail from a brand-new domain is
treated as suspicious by default, and without these the acceptance letters this
system sends will land in spam:

| Type | Name | Value |
|---|---|---|
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` |
| TXT | `google._domainkey` | *(generate in Admin console, Gmail, Authenticate email)* |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:admin@<domain>` |

DKIM has to be generated in the console and then **switched on** there after
the record is published — generating it is not enough, and this is the step
people skip. Start DMARC at `p=none` and tighten it to `quarantine` only after
a few weeks of clean reports.

### Warm the domain up before the first real send

`wipeg.online` was registered days ago, and most spam-protection services
distrust a domain for roughly its first 30 days regardless of TLD. The first
thing this system will do at scale is email a cohort of applicants their
admission decision — which is exactly the kind of send that gets a young
domain blocked, and exactly the kind you cannot afford to have land in spam.

So, in order: get SPF, DKIM and DMARC right (above), then spend a few weeks
using the domain for ordinary staff-to-staff and staff-to-enquirer
correspondence before any batch goes out. The booking confirmations from step 6
of [prompt.md](../prompt.md) make good natural warm-up traffic — low volume,
real recipients, people who expect the mail and will open it.

Worth scheduling backwards from the first intake rather than discovering it the
week of.

---

## 8. What the backend needs once the Workspace is live

In order, and all of it inside steps 3 and 6 of [prompt.md](../prompt.md):

1. **A Google Cloud project** owned by the Workspace, not by a personal
   account. Set the OAuth consent screen to **Internal**, which restricts
   sign-in to the Workspace and removes the app-verification review entirely.
2. **An OAuth 2.0 client** (Web application), giving
   `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`. Redirect URI
   `http://localhost:6008/api/auth/google/callback` for development, plus the
   production one later.
3. **`GOOGLE_WORKSPACE_DOMAIN`** set to the domain. The backend pins it as
   `hd=` on the sign-in URL *and* re-checks it on the verified email, because
   `hd=` is only a hint and can be stripped by anyone who reads a URL.
4. **A service account** with domain-wide delegation, for the booking calendar
   and later Classroom. Scope it to calendar, directory and Classroom and
   nothing else. The JSON key goes into the host's secret store, never into
   this repository: it can act as any user in the Workspace, so treat it as a
   master key.
5. **A calendar for bookings.** Create a shared calendar — "Admissions calls"
   or similar — rather than using a person's own. A staff member's private
   appointments should not decide whether a prospective student can book, and
   `GOOGLE_CALENDAR_ID` should survive that person leaving.

Every one of these already has a placeholder waiting in
[backend/.env.example](../backend/.env.example).

---

## 9. Order of operations

```
[ ]  1. Get the MINESUP authorisation PDF from the administration
[x]  2. Domain settled: wipeg.online, and the code now agrees
[ ]  3. Add the domain in Vercel; add A + CNAME at Hostinger (keep DNS there)
[ ]  4. Make the homepage read as a school, authorisation number in the footer
[ ]  5. Buy one Business Starter seat on the domain -> unblocks the backend
[ ]  6. Verify the domain (TXT), apply for Education, upload the PDF
[ ]  7. Add MX + SPF + DKIM + DMARC; delete Hostinger's default mail records
[ ]  8. Turn on 2-step verification for admin@ and every staff account
[ ]  8b. Warm the domain up with real low-volume mail before the first intake
[ ]  9. Google Cloud project, OAuth client (Internal), service account, calendar
[ ] 10. Fill backend/.env -> prompt.md step 3 can start
```

Steps 1 and 2 are WIPEG's to answer. Steps 3 to 10 can be done together.

---

## Sources

- [Qualifications for Google Workspace for Education](https://support.google.com/a/answer/134628)
- [Get started with Google Workspace for Education](https://support.google.com/a/answer/2856827)
- [Google Workspace for Education FAQ — approval times](https://knowledge.workspace.google.com/admin/getting-started/editions/google-workspace-for-education-faq)
- [Verify your domain for Google Workspace](https://support.google.com/a/answer/60216)
- [Change your primary domain for Google Workspace](https://support.google.com/a/answer/7009324)
- [Rename user addresses in bulk after changing your primary domain](https://knowledge.workspace.google.com/admin/domains/rename-user-addresses-in-bulk-after-changing-your-primary-domain)
- [Spamhaus on new domains and email deliverability](https://www.spamhaus.org/resource-hub/domain-reputation/xyzs-best-practice-on-new-domains-and-email-deliverability/)
- [Does the TLD affect email deliverability? (Suped)](https://www.suped.com/learn/email-deliverability/does-the-top-level-domain-tld-affect-email-deliverability)
- [MINESUP — an example institutional authorisation record](https://www.minesup.gov.cm/index.php/centuring-innovating-higher-institute/)
- [Ministers warn against illegal private universities (University World News, 2022)](https://www.universityworldnews.com/post.php?story=20220216124857435)
