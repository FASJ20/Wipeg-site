# Content to replace before going live

Everything on the site came from the two WIPEG fliers **except** the items
below. Each is marked in the source with `🔶 PLACEHOLDER`. Search the repo for
that emoji to find them all.

Most of them live in one file: **`src/data/site.ts`**.

---

## 1. Contact details — `src/data/site.ts`

| Field | Current value | Action |
| --- | --- | --- |
| `school.email` | `info@wipeg.cm` | **Invented.** No email appears on either flier. Replace with the real address — it is used in the footer, the contact page and as the target of the enquiry form. |
| `school.hours` | `Mon–Fri 8:00–17:00 · Sat 9:00–13:00` | **Invented.** Confirm the registry's real office hours. |
| `school.socials` | four `#` links | **Invented.** Add the real Facebook / WhatsApp / Instagram / LinkedIn URLs, or delete the entries you don't have — the footer renders whatever is in the array. |

Verified from the fliers and safe to leave: name, motto, `AUTH. N° 23-07002/NHA/MINESUP/DDES/ESUP/SDA/MF`,
MINESUP affiliation, both phone numbers, the Bamenda/Ntambessi campus address,
all award levels, all ten departments and their courses, the four partner
institutions, and the four "Why choose WIPEG" offers.

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

`wipeg-crest.png` and `minesup.png` were cut out of the flier JPEG, so they are
only ~94px across and look soft above ~56px. **Ask the school for the original
vector or high-resolution logo** and overwrite these two files, keeping the same
names and transparent backgrounds.

## 12. Photography — `public/images/`

Every photo is AI-generated (from the `Images/` folder). They are consistent and
on-brand but they are not the real campus, real students or real staff. Replace
with real photography when available — keep the same filenames and the whole
site picks them up. The originals are untouched in `Images/`.

## 13. Domain — `src/app/layout.tsx`

`metadataBase` is set to `https://wipeg.cm`. Change it to the real domain so
Open Graph and canonical URLs resolve correctly.
