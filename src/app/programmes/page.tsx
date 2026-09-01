import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { PageHero } from "@/components/site/PageHero";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Icon } from "@/components/ui/Icon";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { departments, school, totalCourses } from "@/data/site";

export const metadata: Metadata = {
  title: "Programmes",
  description:
    "All WIPEG programmes across ten academic departments — HND/BTS, Bachelors and Masters degrees, vocational training and IT certifications in Bamenda, Cameroon.",
};

export default function ProgrammesPage() {
  return (
    <>
      <PageHero
        eyebrow="Our programmes"
        title="Ten departments. Every programme WIPEG offers."
        intro={`${totalCourses} programmes leading to ${school.awards.join(", ")} — all taught at the Bamenda campus.`}
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Programmes" }]}
      >
        <div className="flex flex-wrap justify-center gap-2">
          {school.awards.map((a) => (
            <span
              key={a}
              className="rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-[0.72rem] font-semibold text-white/75"
            >
              {a}
            </span>
          ))}
        </div>
      </PageHero>

      {/* Quick jump list */}
      <section className="border-b border-brand-900/6 bg-white py-8">
        <Reveal className="container-page flex flex-wrap justify-center gap-2">
          {departments.map((d) => (
            <a
              key={d.slug}
              href={`#${d.slug}`}
              className="rounded-full border border-brand-900/10 px-4 py-2 text-[0.78rem] font-semibold text-slate-ink transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-500 hover:text-accent-500"
            >
              {d.short}
            </a>
          ))}
        </Reveal>
      </section>

      {/* Department blocks */}
      <section className="bg-white pb-24 pt-16 lg:pb-32">
        <div className="container-page flex flex-col gap-20 lg:gap-28">
          {departments.map((d, i) => (
            <div
              key={d.slug}
              id={d.slug}
              className="grid scroll-mt-28 items-center gap-12 lg:grid-cols-2 lg:gap-16"
            >
              <Reveal
                direction={i % 2 === 0 ? "right" : "left"}
                className={`relative ${i % 2 === 1 ? "lg:order-2" : ""}`}
              >
                <div className="relative aspect-[16/11] overflow-hidden rounded-[1.75rem] shadow-[var(--shadow-lift)]">
                  <Image
                    src={d.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 46vw, 92vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/55 to-transparent" />
                  <span className="absolute bottom-5 left-5 grid size-12 place-items-center rounded-2xl bg-white text-brand-800">
                    <Icon name={d.icon} className="size-6" />
                  </span>
                </div>
              </Reveal>

              <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                <Reveal>
                  <Eyebrow>
                    Department {String(i + 1).padStart(2, "0")}
                  </Eyebrow>
                </Reveal>
                <Reveal delay={0.08}>
                  <h2 className="mt-5 text-[1.8rem] font-extrabold leading-[1.15] text-ink sm:text-[2.2rem]">
                    {d.name}
                  </h2>
                </Reveal>
                <Reveal delay={0.12}>
                  <p className="mt-4 text-[0.95rem] leading-relaxed text-slate-ink">
                    {d.blurb}
                  </p>
                </Reveal>

                <Reveal delay={0.16}>
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {d.levels.map((l) => (
                      <span
                        key={l}
                        className="rounded-full bg-brand-50 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-brand-700"
                      >
                        {l}
                      </span>
                    ))}
                    <span className="rounded-full bg-accent-50 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-accent-600">
                      {d.duration}
                    </span>
                  </div>
                </Reveal>

                <RevealGroup
                  className="mt-7 grid gap-2 sm:grid-cols-2"
                  stagger={0.05}
                >
                  {d.courses.map((c) => (
                    <RevealItem
                      key={c}
                      className="flex items-start gap-2.5 rounded-xl bg-tint/70 px-3.5 py-2.5 text-[0.85rem] font-medium text-ink/85"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent-500" />
                      {c}
                    </RevealItem>
                  ))}
                </RevealGroup>

                <Reveal delay={0.14} className="mt-7">
                  <Link
                    href={`/programmes/${d.slug}`}
                    className="group inline-flex items-center gap-2 text-[0.9rem] font-bold text-brand-800 transition-colors hover:text-accent-500"
                  >
                    Full department details
                    <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </Reveal>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-tint py-20">
        <Reveal className="container-page text-center">
          <h2 className="text-[1.8rem] font-extrabold text-ink sm:text-[2.2rem]">
            Not sure which programme fits?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[0.95rem] leading-relaxed text-slate-ink">
            Call the registry on {school.phones[0]} or send us an enquiry and
            we&rsquo;ll talk it through with you.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button href="/admissions" variant="accent" size="lg">
              How to apply
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
            <Button href="/contact" variant="outline" size="lg">
              Talk to the registry
            </Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
