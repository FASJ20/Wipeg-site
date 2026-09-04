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

## 2. Student numbers — `src/data/site.ts` → `stats`

`1200+ Students enrolled` is **invented** (flagged with `placeholder: true`).
The other three counters are derived from real flier data (10 departments,
43 programmes, 4 partners) and are fine.

## 3. Lecturers — `src/data/site.ts` → `lecturers`

All four names and roles are **invented**, and the photos are classroom scenes
rather than staff portraits. Replace with real heads of department and proper
headshots (portrait crop, roughly 4:5). Drop the section from
`src/app/page.tsx` if the school would rather not name staff.

## 4. Testimonials — `src/data/site.ts` → `testimonials`

All three quotes and names are **invented**. Replace with real, consented
student quotes, or remove `<Testimonials />` from `src/app/page.tsx`.

## 5. News items — `src/data/site.ts` → `news`

All three posts are **invented** and currently link to `/contact` because there
is no blog. Either supply real news, or remove `<NewsSection />` from
`src/app/page.tsx`.

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

## 9. Map — `src/app/campus/page.tsx`

The map is a styled placeholder panel, not a real map. Once the school confirms
the exact gate coordinates, swap it for a Google Maps or OpenStreetMap embed.

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

**Deliberately not done:** the real photographs are never attached to an
invented name. The lecturer cards and testimonials still use AI imagery,
because putting a real, identifiable person's face next to a made-up name and
quote would misrepresent them. Only swap those to real photos together with
real names and real consent.

## 13. Domain — `src/app/layout.tsx`

`metadataBase` is set to `https://wipeg.cm`. Change it to the real domain so
Open Graph and canonical URLs resolve correctly.
