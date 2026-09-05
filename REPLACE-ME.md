# Content to replace before going live

Everything on the site came from the two WIPEG fliers **except** the items
below. Each is marked in the source with `🔶 PLACEHOLDER`. Search the repo for
that emoji to find them all.

Most of them live in one file: **`src/data/site.ts`**.

---

## 1. Contact details — `src/data/site.ts`

| Field | Current value | Action |
| --- | --- | --- |
| `school.email` | `wipeggaroua@gmail.com` | ✅ **Now real** — taken from the 2026 posters. |
| `school.hours` | `Mon–Fri 8:00–17:00 · Sat 9:00–13:00` | **Invented.** Confirm the registry's real office hours. |
| `school.socials` | Facebook and Instagram are `#` | The posters show Facebook, WhatsApp and Instagram icons but never print the handles. WhatsApp is wired to the main phone number; **add the real Facebook and Instagram URLs**. |

Verified from the fliers and the 2026 posters, safe to leave: name, motto,
crest ribbon, `AUTH. N° 23-07002/NHA/MINESUP/DDES/ESUP/SDA/MF`, MINESUP
affiliation, mentorship by the University of Maroua, affiliation to the
University of Bamenda, all three phone numbers, the email address, the Garoua
main campus address, the five branch cities and their numbers, all award
levels, all ten departments and their courses, the four partner institutions,
and the four "Why choose WIPEG" offers.

## 2. Counters — `src/data/site.ts` → `stats`

✅ **No invented numbers remain here.** The "1,200+ students enrolled" figure
was made up and has been removed, along with the matching pill on the home
hero (now the campus network instead).

All four counters are derived from the real lists in this file — departments,
programmes, partners and branches — so they stay correct automatically when
those lists change.

If the school wants a genuine enrolment figure published, add it here and to
the hero. Don't estimate it.

## 3. Our team — removed for now

✅ The "Our team" section is gone, along with its four invented lecturer names
and its component. Nothing on the site now names a member of staff.

To bring it back later you need, per person: real name, real role, and a
portrait they have consented to (portrait crop, roughly 4:5). Ask me and I'll
rebuild it — the design is in git history at commit `bfcf089`.

## 4. Testimonials — real names, drafted words

The section is back with three **real** graduates supplied by the school:

| Name | Role |
| --- | --- |
| Fai Arnold | Software Engineer |
| Fai Sheryl | Marketer |
| Viban Randolph | Entertainment |

🔶 **The quotes are drafts I wrote, not words these people said.** Each named
person must approve or rewrite their own quote before this site is published —
attributing invented words to a real, identifiable person is exactly the
problem the removed placeholders had.

Edit them in `src/data/site.ts` → `testimonials`.

**Photos:** deliberately none. The section shows initials (FA, FS, VR) rather
than pairing a real name with a stock or AI face. When you have a real portrait
with that person's consent, drop it in `/public/images` and set `photo` on
their entry — the component switches from initials to the photo automatically.

## 5. News — removed

✅ The invented news posts are gone, along with the section and its component.

If the school wants a news feed later, that is a real feature to build (a blog
with its own pages), not three cards linking to the contact page.

## 5b. Online study — confirm which departments qualify

✅ The rule itself is from the school: most programmes can be followed online
from anywhere in Cameroon; hands-on fields stay on campus; **defence and
examinations are always written on site**, online students included.

🔶 **The split between the two is my reading**, not something the school
stated department by department:

| On campus only | Online or on campus |
| --- | --- |
| Medical & Biomedical Sciences | Computer Engineering |
| Home Economics | Management |
| Agricultural and Food Sciences | Legal Careers |
| Mining and Petroleum Engineering | IT Programs, Education, Business & Finance |

Computer Engineering is the doubtful one — software and networks travel well
online, but Computer Hardware Maintenance and Industrial Computing and
Automation need lab time. Confirm with the registry.

**To correct any of it:** flip `onlineAvailable` on that department in
`src/data/site.ts`. The chips, the department page callout and the
programmes-page summary all follow automatically.

## 6. Entry requirements — `src/data/site.ts` → `entryRequirements`

A plausible list based on the Cameroonian system, **not** taken from the
fliers. Confirm with the registry. Shown on `/admissions` and on every
department page.

## 7. Fees

No figures are published anywhere on the site — the admissions page tells
visitors to call the registry instead. The flier facts (moderate fees, payable
in installments, scholarships available) *are* used and are accurate. Add a
real fee schedule if the school wants one published.

## 8. Facilities — `src/app/campus/page.tsx` → `facilities`

The four facility descriptions are **plausible but invented**. Confirm which
facilities actually exist and how to describe them.

## 9. Map — `src/data/site.ts` → `school.campus`

✅ A real Google Map is now embedded on the campus page, with a "Get
directions" button. It needs no API key.

Google resolves `mapQuery` ("Collège Bilingue de l'Espoir, Plateau, Garoua")
and drops the pin on **Middle School De L'espoir, 8CM3+V89, Garoua** — the
right landmark, with the campus behind it.

🔶 `coords` is still only the Plateau quarter centroid from OpenStreetMap,
which has no entry for the college. **To put the pin exactly on the campus
gate:** open Google Maps, right-click the gate, click the coordinates to copy
them, and paste them into `school.campus.coords`. Optionally set `mapQuery` to
WIPEG's own Google Business listing once it exists.

Note: the embed required `frame-src https://www.google.com` in the CSP
(`next.config.ts`). Without it the iframe is blocked silently — an empty box,
no console error.

## 10. The enquiry form — `src/components/site/EnquiryForm.tsx`

**Front-end only.** Submitting opens the visitor's mail client addressed to
`school.email`. It does not send anything by itself and nothing is stored.

To make it actually send, replace the body of `handleSubmit` with a POST to an
endpoint — [Formspree](https://formspree.io), [Web3Forms](https://web3forms.com),
or your own `app/api/enquiry/route.ts`. The form is used on both `/admissions`
and `/contact`.

## 11. Logo artwork — `public/brand/`

✅ `wipeg-crest.png` is now the official 640px crest supplied by the school,
cut out with a transparent background. A vector version would still be better
for print, but this is sharp at every size the site uses.

`minesup.png` is still a ~94px crop from the flier and looks soft above ~56px.
Replace it if you have the original.

## 12. Photography — `public/images/`

Files prefixed `real-` are **genuine WIPEG photographs** supplied by the school
(graduation ceremonies, awards, addresses). They are used on the home hero, the
about section, the news cards and the campus gallery.

The rest are AI-generated stand-ins, still used for department and programme
cards. Replace them with real photography of each department when available —
keep the same filenames and the site picks them up.

**Deliberately not done:** no photograph is ever attached to an invented
name. The testimonials show monogram initials rather than faces, because
pairing a real, identifiable person with a stock or AI portrait would
misrepresent them. Add a real photo only together with that person's consent.

## 13. Domain — `src/app/layout.tsx`

`metadataBase` is set to `https://wipeg.cm`. Change it to the real domain so
Open Graph and canonical URLs resolve correctly.
