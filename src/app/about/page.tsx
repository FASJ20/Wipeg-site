import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, Compass, Eye, HeartHandshake, ShieldCheck } from "lucide-react";

import { PageHero } from "@/components/site/PageHero";
import { Button } from "@/components/ui/Button";
import { Counter } from "@/components/ui/Counter";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { GlowField } from "@/components/ui/GlowField";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { advantages, partners, school, stats } from "@/data/site";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = {
  title: "About the institute",
  description:
    "WIPEG — the Wisdom Institute for Professionalism and Excellent Growth — is a MINESUP-affiliated higher and vocational institute in Bamenda, Cameroon.",
};

const values = [
  {
    icon: Compass,
    title: "Our mission",
    body: "To train students to a professional standard they can carry straight into work — in the ward, the workshop, the office or their own enterprise.",
  },
  {
    icon: Eye,
    title: "Our vision",
    body: "A Bamenda institute whose graduates are recognised across Cameroon for competence, integrity and the discipline to keep learning.",
  },
  {
    icon: HeartHandshake,
    title: "Our promise",
    body: "Nobody should lose a place over money alone. Fees stay moderate, are payable in installments, and scholarships are offered every intake.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About WIPEG"
        title="Professionalism & Excellent Growth — the standard we hold every programme to"
        intro={`${school.name} is a higher and vocational institute in Bamenda, operating under authorisation N° ${school.authNumber} and affiliated to the ${school.ministry}.`}
        breadcrumb={[{ label: "Home", href: "/" }, { label: "About" }]}
      />

      {/* ------------------------------- story -------------------------- */}
      <section className="bg-white py-24 lg:py-32">
        <div className="container-page grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
          <Reveal direction="right" className="relative">
            <div className="relative aspect-[5/4] overflow-hidden rounded-[2rem] shadow-[var(--shadow-lift)]">
              <Image
                src="/images/hero-lecture-hall.jpg"
                alt="A WIPEG lecture in progress in the main hall"
                fill
                sizes="(min-width: 1024px) 44vw, 92vw"
                className="object-cover"
              />
            </div>
            <div className="absolute -bottom-8 -right-4 hidden w-48 overflow-hidden rounded-[1.5rem] border-[6px] border-white shadow-[var(--shadow-lift)] sm:block lg:-right-8">
              <div className="relative aspect-square">
                <Image
                  src="/images/graduation.jpg"
                  alt="WIPEG graduands"
                  fill
                  sizes="200px"
                  className="object-cover"
                />
              </div>
            </div>
          </Reveal>

          <div>
            <Reveal>
              <Eyebrow>Who we are</Eyebrow>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink sm:text-[2.6rem]">
                One institute, ten departments, one standard
              </h2>
            </Reveal>
            <Reveal delay={0.14}>
              <div className="mt-6 flex flex-col gap-4 text-[0.98rem] leading-relaxed text-slate-ink">
                <p>
                  WIPEG brings together clinical training, engineering,
                  management, law, information technology, education, home
                  economics, agriculture, business and mining under a single
                  authorised roof in Bamenda. Whichever department a student
                  joins, the expectation is the same: supervised practice,
                  lecturers who teach rather than dictate, and a qualification
                  that stands up outside the classroom.
                </p>
                <p>
                  We award HND and BTS diplomas, Bachelors and Masters degrees,
                  vocational training certificates and IT certifications — and we
                  work with four partner institutions so that finishing one level
                  at WIPEG opens the door to the next.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="mt-8 flex items-start gap-4 rounded-2xl border border-brand-800/12 bg-brand-50/60 p-5">
                <ShieldCheck className="mt-0.5 size-6 shrink-0 text-brand-800" />
                <p className="text-[0.88rem] leading-relaxed text-slate-ink">
                  <span className="font-bold text-brand-800">
                    Authorisation N° {school.authNumber}
                  </span>
                  <br />
                  Affiliated to the {school.ministry}.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.26} className="mt-8">
              <Button href="/programmes" variant="brand" size="lg">
                See all programmes
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ------------------------------ counters ------------------------ */}
      <section className="relative overflow-hidden rounded-[2rem] bg-ink py-16 text-white sm:rounded-[3rem]">
        <GlowField variant="section" />
        <RevealGroup className="container-page relative grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((s) => (
            <RevealItem key={s.label} className="text-center">
              <p className="text-[2.6rem] font-extrabold leading-none text-gold-400 sm:text-[3.2rem]">
                <Counter value={s.value} suffix={s.suffix} />
              </p>
              <p className="mt-3 text-[0.8rem] font-medium text-white/60">
                {s.label}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* ------------------------------- values ------------------------- */}
      <section className="bg-white py-24 lg:py-32">
        <div className="container-page">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Eyebrow>What drives us</Eyebrow>
            <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink sm:text-[2.6rem]">
              Mission, vision and the promise behind them
            </h2>
          </Reveal>

          <RevealGroup className="mt-14 grid gap-6 lg:grid-cols-3">
            {values.map(({ icon: Ico, title, body }) => (
              <RevealItem
                key={title}
                className="group relative overflow-hidden rounded-[1.5rem] border border-brand-900/8 bg-white p-7 transition-all duration-500 ease-[var(--ease-out-quint)] hover:-translate-y-2 hover:border-brand-800/20 hover:shadow-[var(--shadow-lift)]"
              >
                <span
                  aria-hidden
                  className="absolute -right-12 -top-12 size-32 rounded-full bg-brand-50 transition-transform duration-700 group-hover:scale-150"
                />
                <span className="relative grid size-13 place-items-center rounded-2xl bg-brand-800 text-white transition-colors duration-500 group-hover:bg-accent-500">
                  <Ico className="size-6" />
                </span>
                <h3 className="relative mt-6 text-[1.15rem] font-bold text-ink">
                  {title}
                </h3>
                <p className="relative mt-3 text-[0.9rem] leading-relaxed text-slate-ink">
                  {body}
                </p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ----------------------------- advantages ----------------------- */}
      <section className="bg-tint py-24 lg:py-32">
        <div className="container-page">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Eyebrow>Included with every programme</Eyebrow>
            <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink sm:text-[2.6rem]">
              What being a WIPEG student gets you
            </h2>
          </Reveal>

          <RevealGroup className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {advantages.map((a) => (
              <RevealItem
                key={a.title}
                className="group rounded-[1.35rem] bg-white p-6 transition-all duration-500 hover:-translate-y-2 hover:shadow-[var(--shadow-lift)]"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-accent-50 text-accent-500 transition-colors duration-500 group-hover:bg-accent-500 group-hover:text-white">
                  <Icon name={a.icon} className="size-5" />
                </span>
                <h3 className="mt-5 text-[1rem] font-bold leading-snug text-ink">
                  {a.title}
                </h3>
                <p className="mt-2.5 text-[0.85rem] leading-relaxed text-slate-ink">
                  {a.body}
                </p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ------------------------------ partners ------------------------ */}
      <section className="bg-white py-24 lg:py-32">
        <div className="container-page grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <Reveal>
              <Eyebrow>Our featuring partners</Eyebrow>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink sm:text-[2.6rem]">
                Institutions we work with
              </h2>
            </Reveal>
            <Reveal delay={0.14}>
              <p className="mt-5 text-[0.98rem] leading-relaxed text-slate-ink">
                Our partnerships create progression routes for WIPEG graduates
                and keep our syllabuses aligned with what universities and
                employers across Cameroon actually expect.
              </p>
            </Reveal>
          </div>

          <RevealGroup className="flex flex-col gap-4">
            {partners.map((p, i) => (
              <RevealItem
                key={p}
                className="group flex items-center gap-5 rounded-2xl border border-brand-900/8 bg-white p-5 transition-all duration-400 hover:-translate-y-1 hover:border-accent-500/30 hover:shadow-[var(--shadow-card)]"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-50 text-[0.9rem] font-extrabold text-brand-800 transition-colors duration-400 group-hover:bg-accent-500 group-hover:text-white">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[0.95rem] font-semibold text-ink">{p}</span>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>
    </>
  );
}
