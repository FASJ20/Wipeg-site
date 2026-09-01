# WIPEG — Wisdom Institute for Professionalism and Excellent Growth

Website for WIPEG, Bamenda, Cameroon. Built with Next.js 16 (App Router),
React 19, TypeScript, Tailwind CSS v4 and Motion.

## Running it

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:6007>.

```bash
npm run build
```

The whole site prerenders to static HTML (20 routes, including `robots.txt`
and `sitemap.xml`), so it can be hosted on Vercel, Netlify, or any static host
after `next build`.

`npm run start` serves the production build, also on port 6007.

## Where things live

```
src/
  app/                    routes — one folder per page
    page.tsx              home (all eleven sections)
    about/  programmes/  admissions/  campus/  contact/
    programmes/[slug]/    one page per academic department
    layout.tsx            fonts, metadata, header/footer shell
    globals.css           design tokens, keyframes, utilities
  components/
    site/                 Header, Footer, PageHero, ScrollProgress, EnquiryForm
    home/                 the eleven home-page sections
    ui/                   Reveal, WordReveal, Counter, Accordion, Button, …
  data/site.ts            ALL content — edit copy here, not in components
public/
  images/                 web-optimised photos
  brand/                  crest + MINESUP mark
Images/                   original source files (fliers, video, AI photos)
```

**To change wording, programmes, phone numbers or FAQs, edit
`src/data/site.ts`.** Adding a course to a department automatically updates the
navigation dropdown, the programme count, the department page and the footer.

## Design system

Colours are sampled from the official fliers and defined as tokens in
`src/app/globals.css`:

| Token | Value | Use |
| --- | --- | --- |
| `brand-800` | `#102b94` | WIPEG royal blue — primary |
| `accent-500` | `#e73907` | WIPEG orange-red — CTAs, active states |
| `gold-400` | `#f7c343` | badges, highlights, hero CTA |
| `ink` | `#08123a` | the dark navy behind hero, footer and feature sections |

Typeface is **Poppins** (loaded via `next/font`), matching the geometric sans
used across the fliers.

## Animation

Motion is deliberate and all of it degrades: every animated component checks
`useReducedMotion()`, and `globals.css` disables animation entirely under
`prefers-reduced-motion: reduce`.

- Hero — staggered word-by-word headline reveal, autoplaying 3-slide carousel
  with a progress indicator, drifting CSS gradient blobs, floating stat chips.
- Scroll reveals — `Reveal` / `RevealGroup` / `RevealItem` wrap sections and
  fire once via `whileInView`.
- Counters — count up on first view (`Counter`).
- Marquee — CSS-only infinite partner strip, pauses on hover.
- Carousels — Embla for the department strip; hand-rolled for hero and
  testimonials.
- Accordion — height-animated FAQ.
- Cards — lift on hover with a slow image zoom.

> **Note on `Reveal`:** it uses a static map of motion primitives rather than
> `motion.create(tag)`. Calling `motion.create()` during render produces a new
> component type each pass, which remounts the subtree and re-fires
> `whileInView` forever ("Maximum update depth exceeded"). Keep the map.

## Security

The site is static, has no database, no authentication, no user accounts and no
`dangerouslySetInnerHTML`, so the attack surface is small by construction. On
top of that:

**Response headers** (`next.config.ts` → `headers()`), applied to every route:

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | same-origin everything; `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests` |
| `X-Frame-Options` | `DENY` — clickjacking protection for older browsers |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | camera, microphone, geolocation, payment, USB and sensors all denied |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `X-Permitted-Cross-Domain-Policies` | `none` |
| `Strict-Transport-Security` | 2 years, `includeSubDomains; preload` — **production only** |

`poweredByHeader` is off, so no `X-Powered-By` version disclosure.

**Image optimiser** — `remotePatterns` is empty, so the optimiser cannot be used
as an open proxy for arbitrary remote URLs. SVG optimisation is disabled
(`dangerouslyAllowSVG: false`) and optimised responses carry
`Content-Disposition: attachment`.

**The enquiry form** — every single-line field is stripped of CR/LF and length
capped before it is put into the `mailto:` URL, so a crafted value cannot inject
extra mail headers. The programme field is validated against the real department
list rather than echoed back. Nothing is stored or transmitted server-side.

**Outbound links** — any off-site link (currently only the social icons) opens
with `rel="noopener noreferrer"`, so the destination gets neither a handle on
the opener window nor the full referrer.

**Dependencies** — `npm audit` is clean. Re-run it before each deploy:

```bash
npm audit --omit=dev
```

### Tightening the CSP further

`script-src` currently allows `'unsafe-inline'` because the App Router emits
inline bootstrap scripts. To remove it, generate a per-request nonce in
`middleware.ts` and pass it through the CSP header. The trade-off is that every
page then renders dynamically instead of being prerendered, which gives up
static hosting — worth it only if the site later grows forms, logins or
user-submitted content.

## Before going live

See **[REPLACE-ME.md](REPLACE-ME.md)** — the list of invented content
(lecturer names, testimonials, news, email address, entry requirements) that
must be swapped for real information, plus the note that the enquiry form is
front-end only.
