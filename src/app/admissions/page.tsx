import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, Phone } from "lucide-react";

import { PageHero } from "@/components/site/PageHero";
import { EnquiryForm } from "@/components/site/EnquiryForm";
import { Accordion } from "@/components/ui/Accordion";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { GlowField } from "@/components/ui/GlowField";
import { Icon } from "@/components/ui/Icon";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";
import {
  admissionSteps,
  advantages,
  entryRequirements,
  faqs,
  school,
} from "@/data/site";

export const metadata: Metadata = {
  title: "Admissions",
  description:
    "How to apply to WIPEG Bamenda — entry requirements, the application steps, fees paid in installments, scholarships, and the enquiry form.",
};

export default function AdmissionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Admissions"
        title="Applying to WIPEG takes four steps"
        intro="Admissions are open across all ten departments. Start with the programme you want, and the registry will take you through the rest."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Admissions" }]}
      >
        <div className="flex flex-wrap justify-center gap-4">
          <Button href="#enquiry" variant="accent" size="lg">
            Send an enquiry
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

      {/* ------------------------------- steps -------------------------- */}
      <section className="bg-white py-24 lg:py-32">
        <div className="container-page">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink sm:text-[2.6rem]">
              From choosing a programme to your first class
            </h2>
          </Reveal>

          <RevealGroup className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {admissionSteps.map((s, i) => (
              <RevealItem key={s.title} className="relative">
                {/* Connector line between steps on wide screens */}
                {i < admissionSteps.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-[calc(50%+2.5rem)] top-7 hidden h-px w-[calc(100%-5rem)] bg-gradient-to-r from-brand-200 to-transparent lg:block"
                  />
                )}
                <div className="group relative rounded-[1.35rem] border border-brand-900/8 bg-white p-6 transition-all duration-500 hover:-translate-y-2 hover:border-brand-800/20 hover:shadow-[var(--shadow-lift)]">
                  <span className="grid size-14 place-items-center rounded-full bg-brand-800 text-[1.15rem] font-extrabold text-white transition-colors duration-500 group-hover:bg-accent-500">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-6 text-[1.05rem] font-bold leading-snug text-ink">
                    {s.title}
                  </h3>
                  <p className="mt-2.5 text-[0.87rem] leading-relaxed text-slate-ink">
                    {s.body}
                  </p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* --------------------------- requirements ----------------------- */}
      <section className="bg-tint py-24 lg:py-32">
        <div className="container-page grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
          <Reveal direction="right" className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-[var(--shadow-lift)]">
              <Image
                src="/images/lecturer-banner.jpg"
                alt="WIPEG lecturer with the institute's programme banner"
                fill
                sizes="(min-width: 1024px) 44vw, 92vw"
                className="object-cover"
              />
            </div>
          </Reveal>

          <div>
            <Reveal>
              <Eyebrow>Entry requirements</Eyebrow>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink sm:text-[2.6rem]">
                What you need to bring
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-5 text-[0.95rem] leading-relaxed text-slate-ink">
                Requirements vary by the level you are applying to. If you are
                unsure whether your certificates qualify, bring them to the
                registry and we will check with you.
              </p>
            </Reveal>

            {/* 🔶 PLACEHOLDER — confirm this list with the WIPEG registry */}
            <RevealGroup className="mt-8 flex flex-col gap-3" stagger={0.07}>
              {entryRequirements.map((r) => (
                <RevealItem
                  key={r}
                  className="flex items-start gap-3 rounded-2xl bg-white px-5 py-4 text-[0.9rem] leading-relaxed text-ink/85 shadow-[var(--shadow-card)]"
                >
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent-500" />
                  {r}
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </div>
      </section>

      {/* ------------------------------- fees --------------------------- */}
      <section className="relative overflow-hidden rounded-[2rem] bg-ink py-20 text-white sm:rounded-[3rem] lg:py-24">
        <GlowField variant="section" />
        <div className="container-page relative">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Eyebrow tone="dark">Fees &amp; support</Eyebrow>
            <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] sm:text-[2.6rem]">
              Moderate fees, and no student turned away for timing
            </h2>
            <p className="mt-5 text-[0.98rem] leading-relaxed text-white/65">
              WIPEG keeps fees moderate and lets you pay in installments across
              the academic year. Scholarship places are offered each intake.
            </p>
          </Reveal>

          <RevealGroup className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {advantages.map((a) => (
              <RevealItem
                key={a.title}
                className="group rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-6 transition-all duration-500 hover:-translate-y-2 hover:border-white/25 hover:bg-white/[0.07]"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-accent-500/15 text-accent-300 ring-1 ring-accent-500/25 transition-colors duration-500 group-hover:bg-accent-500 group-hover:text-white">
                  <Icon name={a.icon} className="size-5" />
                </span>
                <h3 className="mt-5 text-[1rem] font-bold leading-snug">
                  {a.title}
                </h3>
                <p className="mt-2.5 text-[0.85rem] leading-relaxed text-white/60">
                  {a.body}
                </p>
              </RevealItem>
            ))}
          </RevealGroup>

          {/* 🔶 PLACEHOLDER — exact fee figures are not published on the fliers */}
          <Reveal delay={0.1} className="mt-12 text-center">
            <p className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 text-[0.85rem] leading-relaxed text-white/55">
              Exact fee figures are issued by the registry per programme and
              level. Call {school.phones[0]} for the current schedule.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------ enquiry ------------------------- */}
      <section id="enquiry" className="scroll-mt-24 bg-white py-24 lg:py-32">
        <div className="container-page grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div>
            <Reveal>
              <Eyebrow>Enquire</Eyebrow>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink sm:text-[2.6rem]">
                Send us your application enquiry
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-5 text-[0.95rem] leading-relaxed text-slate-ink">
                Tell us which programme you are interested in and how to reach
                you. The registry replies with the requirements, the fee
                schedule and the next intake date.
              </p>
            </Reveal>

            <Reveal delay={0.18} className="mt-9">
              <Accordion items={faqs.slice(0, 4)} defaultOpen={null} />
            </Reveal>
          </div>

          <Reveal direction="left" delay={0.1}>
            <div className="rounded-[1.75rem] border border-brand-900/8 bg-tint/50 p-7 sm:p-9">
              <EnquiryForm />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
