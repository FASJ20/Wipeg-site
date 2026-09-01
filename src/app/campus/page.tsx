import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, BookOpen, FlaskConical, MapPin, Monitor, Phone, Presentation } from "lucide-react";

import { PageHero } from "@/components/site/PageHero";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { school } from "@/data/site";

export const metadata: Metadata = {
  title: "Campus & facilities",
  description:
    "The WIPEG Bamenda campus at Ntambessi — lecture halls, computer laboratory, library and practical training spaces.",
};

/* 🔶 PLACEHOLDER — facility descriptions are illustrative; confirm with the
   school which facilities to feature and in what detail. */
const facilities = [
  {
    icon: Presentation,
    title: "Lecture halls",
    body: "Purpose-built teaching spaces with projection, used across all ten departments.",
  },
  {
    icon: Monitor,
    title: "Computer laboratory",
    body: "Workstations for the computer engineering and IT certification tracks — networks, web design and development.",
  },
  {
    icon: FlaskConical,
    title: "Practical rooms",
    body: "Spaces for medical and biomedical practicals, home economics studios and agropastoral work.",
  },
  {
    icon: BookOpen,
    title: "Library & study areas",
    body: "Reference materials and quiet study space for coursework and revision.",
  },
];

const gallery = [
  { src: "/images/hero-lecture-hall.jpg", alt: "A WIPEG lecture in the main hall", span: "sm:col-span-2 sm:row-span-2" },
  { src: "/images/computer-lab.jpg", alt: "Students in the WIPEG computer laboratory", span: "" },
  { src: "/images/library-group.jpg", alt: "Students studying together in the library", span: "" },
  { src: "/images/lecturer-values.jpg", alt: "A lecturer presenting the WIPEG core values", span: "sm:col-span-2" },
  { src: "/images/graduation.jpg", alt: "WIPEG graduands on graduation day", span: "" },
  { src: "/images/medical-lecture.jpg", alt: "A medical sciences lecture at WIPEG", span: "" },
  { src: "/images/lecturer-programmes.jpg", alt: "A lecturer presenting the WIPEG programmes", span: "sm:col-span-2" },
  { src: "/images/mentoring.jpg", alt: "A lecturer mentoring WIPEG students", span: "" },
  { src: "/images/library-study.jpg", alt: "WIPEG students working in the library", span: "" },
  { src: "/images/graduates.jpg", alt: "WIPEG graduates in academic gowns", span: "" },
  { src: "/images/lecturer-career.jpg", alt: "A career development session at WIPEG", span: "" },
];

export default function CampusPage() {
  return (
    <>
      <PageHero
        eyebrow="Our campus"
        title={`The ${school.campus.name} at ${school.campus.line}`}
        intro={school.campus.detail}
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Campus" }]}
      >
        <div className="flex flex-wrap justify-center gap-4">
          <Button href="/contact" variant="accent" size="lg">
            Arrange a visit
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Button>
          <Button
            href={`tel:${school.phones[0].replace(/\s/g, "")}`}
            variant="ghost-light"
            size="lg"
          >
            <Phone className="size-4" />
            {school.phones[0]}
          </Button>
        </div>
      </PageHero>

      {/* ---------------------------- facilities ------------------------ */}
      <section className="bg-white py-24 lg:py-32">
        <div className="container-page">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Eyebrow>Facilities</Eyebrow>
            <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink sm:text-[2.6rem]">
              Where the practicals actually happen
            </h2>
          </Reveal>

          <RevealGroup className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {facilities.map(({ icon: Ico, title, body }) => (
              <RevealItem
                key={title}
                className="group rounded-[1.35rem] border border-brand-900/8 bg-white p-6 transition-all duration-500 hover:-translate-y-2 hover:border-brand-800/20 hover:shadow-[var(--shadow-lift)]"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-800 transition-colors duration-500 group-hover:bg-accent-500 group-hover:text-white">
                  <Ico className="size-5" />
                </span>
                <h3 className="mt-5 text-[1rem] font-bold text-ink">{title}</h3>
                <p className="mt-2.5 text-[0.85rem] leading-relaxed text-slate-ink">
                  {body}
                </p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ------------------------------ gallery ------------------------- */}
      <section className="bg-tint py-24 lg:py-32">
        <div className="container-page">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Eyebrow>Campus life</Eyebrow>
            <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink sm:text-[2.6rem]">
              A look around WIPEG
            </h2>
          </Reveal>

          <RevealGroup
            className="mt-14 grid auto-rows-[13rem] grid-cols-2 gap-4 lg:grid-cols-4"
            stagger={0.06}
          >
            {gallery.map((g) => (
              <RevealItem
                key={g.src}
                className={`group relative overflow-hidden rounded-[1.25rem] ${g.span}`}
              >
                <Image
                  src={g.src}
                  alt={g.alt}
                  fill
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  className="object-cover transition-transform duration-[900ms] ease-[var(--ease-out-quint)] group-hover:scale-110"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span className="absolute bottom-4 left-4 right-4 translate-y-3 text-[0.78rem] font-semibold leading-snug text-white opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                  {g.alt}
                </span>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ------------------------------ finding -------------------------- */}
      <section className="bg-white py-24 lg:py-32">
        <div className="container-page grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <Reveal>
              <Eyebrow>Finding us</Eyebrow>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink sm:text-[2.6rem]">
                How to reach the campus
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-5 text-[0.98rem] leading-relaxed text-slate-ink">
                {school.campus.detail}
              </p>
            </Reveal>

            <RevealGroup className="mt-8 flex flex-col gap-4" stagger={0.08}>
              <RevealItem className="flex items-start gap-4 rounded-2xl border border-brand-900/8 bg-tint/60 p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-800 text-white">
                  <MapPin className="size-5" />
                </span>
                <span>
                  <span className="block text-[0.7rem] font-bold uppercase tracking-[0.14em] text-accent-500">
                    Address
                  </span>
                  <span className="mt-1 block text-[0.9rem] font-semibold text-ink">
                    {school.campus.line}, Bamenda
                  </span>
                </span>
              </RevealItem>

              <RevealItem className="flex items-start gap-4 rounded-2xl border border-brand-900/8 bg-tint/60 p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-800 text-white">
                  <Phone className="size-5" />
                </span>
                <span>
                  <span className="block text-[0.7rem] font-bold uppercase tracking-[0.14em] text-accent-500">
                    Phone
                  </span>
                  {school.phones.map((p) => (
                    <a
                      key={p}
                      href={`tel:${p.replace(/\s/g, "")}`}
                      className="mt-1 block text-[0.9rem] font-semibold text-ink transition-colors hover:text-accent-500"
                    >
                      {p}
                    </a>
                  ))}
                </span>
              </RevealItem>
            </RevealGroup>
          </div>

          {/* 🔶 PLACEHOLDER — swap for a real embedded map once the school
              confirms the exact coordinates of the campus gate. */}
          <Reveal direction="left" className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-brand-900/8 bg-tint">
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.35]"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(16,43,148,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(16,43,148,0.18) 1px, transparent 1px)",
                  backgroundSize: "44px 44px",
                }}
              />
              <div className="absolute inset-0 grid place-items-center p-8 text-center">
                <div>
                  <span className="relative mx-auto grid size-16 place-items-center rounded-full bg-accent-500 text-white">
                    <span className="animate-pulse-ring absolute inset-0 rounded-full bg-accent-500/60" />
                    <MapPin className="relative size-7" />
                  </span>
                  <p className="mt-5 text-[1.05rem] font-extrabold text-ink">
                    {school.campus.name}
                  </p>
                  <p className="mt-2 text-[0.85rem] leading-relaxed text-slate-ink">
                    {school.campus.line} — towards the first gate of PC Ntaghem
                  </p>
                  <p className="mt-4 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-ink/50">
                    Interactive map to be embedded
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
