import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, MapPin, Monitor } from "lucide-react";

import { PageHero } from "@/components/site/PageHero";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Icon } from "@/components/ui/Icon";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { departments, school, studyModes, totalCourses } from "@/data/site";

export const metadata: Metadata = {
  title: "Programmes",
  description:
    "All WIPEG programmes across ten academic departments — HND/BTS, Bachelors and Masters degrees, vocational training and IT certifications in Garoua, Cameroon.",
};

export default function ProgrammesPage() {
  return (
    <>
      <PageHero
        eyebrow="Our programmes"
        title="Ten departments. Every programme WIPEG offers."
        intro={`${totalCourses} programmes leading to ${school.awards.join(", ")} — taught at our Garoua main campus and every branch.`}
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

      {/* How you can study — online vs on campus */}
      <section className="bg-tint py-16 lg:py-20">
        <div className="container-page">
          <Reveal className="mx-auto max-w-3xl text-center">
            <Eyebrow>How you can study</Eyebrow>
            <h2 className="mt-5 text-[1.9rem] font-extrabold leading-[1.14] text-ink sm:text-[2.3rem]">
              Study online from anywhere in Cameroon
            </h2>
            <p className="mt-5 text-[0.98rem] leading-relaxed text-slate-ink">
              {studyModes.onlineIntro} {studyModes.handsOnRule}
            </p>
          </Reveal>

          <Reveal delay={0.1} className="mx-auto mt-10 grid max-w-4xl gap-5 sm:grid-cols-2">
            <div className="rounded-[1.35rem] border border-brand-800/15 bg-white p-6">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-800 text-white">
                <Monitor className="size-5" />
              </span>
              <h3 className="mt-4 text-[1rem] font-bold text-ink">
                Online or on campus
              </h3>
              <p className="mt-2 text-[0.85rem] leading-relaxed text-slate-ink">
                {departments
                  .filter((d) => d.onlineAvailable)
                  .map((d) => d.short)
                  .join(", ")}
                .
              </p>
            </div>

            <div className="rounded-[1.35rem] border border-accent-500/20 bg-white p-6">
              <span className="grid size-11 place-items-center rounded-2xl bg-accent-500 text-white">
                <MapPin className="size-5" />
              </span>
              <h3 className="mt-4 text-[1rem] font-bold text-ink">
                On campus only
              </h3>
              <p className="mt-2 text-[0.85rem] leading-relaxed text-slate-ink">
                {departments
                  .filter((d) => !d.onlineAvailable)
                  .map((d) => d.short)
                  .join(", ")}{" "}
                — these depend on practical work.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.16} className="mx-auto mt-6 max-w-4xl">
            <p className="flex items-start gap-3 rounded-2xl border border-brand-900/8 bg-white px-5 py-4 text-[0.88rem] font-semibold leading-relaxed text-ink">
              <MapPin className="mt-0.5 size-4 shrink-0 text-accent-500" />
              {studyModes.onsiteRule}
            </p>
          </Reveal>
        </div>
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
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wide ${
                        d.onlineAvailable
                          ? "bg-brand-800/8 text-brand-800 ring-1 ring-brand-800/15"
                          : "bg-accent-500/10 text-accent-600 ring-1 ring-accent-500/20"
                      }`}
                    >
                      {d.onlineAvailable ? (
                        <Monitor className="size-3" />
                      ) : (
                        <MapPin className="size-3" />
                      )}
                      {d.onlineAvailable
                        ? studyModes.onlineLabel
                        : studyModes.onsiteLabel}
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
