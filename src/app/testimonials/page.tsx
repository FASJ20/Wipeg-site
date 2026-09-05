import type { Metadata } from "next";
import { ArrowRight, Check, Phone } from "lucide-react";

import { PageHero } from "@/components/site/PageHero";
import { Testimonials } from "@/components/home/Testimonials";
import { TestimonialForm } from "@/components/site/TestimonialForm";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { GlowField } from "@/components/ui/GlowField";
import { Reveal } from "@/components/ui/Reveal";
import { school } from "@/data/site";

export const metadata: Metadata = {
  title: "Testimonials",
  description:
    "WIPEG graduates on what the institute gave them — hands-on training, fees payable in installments, and free driving and English lessons.",
};

export default function TestimonialsPage() {
  return (
    <>
      <PageHero
        eyebrow="Testimonials"
        title="What our graduates say"
        intro="WIPEG graduates working across software, marketing and entertainment on what the institute actually gave them."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Testimonials" }]}
      >
        <Button href="#share" variant="accent" size="lg">
          Share your testimonial
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Button>
      </PageHero>

      {/* The same section the home page uses, minus its duplicate heading.
          No container-page wrapper here — the component brings its own, and
          nesting the two double-pads the content. */}
      <div className="bg-white pt-20 lg:pt-24">
        <Testimonials showHeading={false} />
      </div>

      {/* ------------------------ share your own ------------------------ */}
      <section id="share" className="scroll-mt-24 bg-tint py-24 lg:py-32">
        <div className="container-page grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div>
            <Reveal>
              <Eyebrow>Share yours</Eyebrow>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink sm:text-[2.6rem]">
                Studied at WIPEG? Tell your story
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-5 text-[0.95rem] leading-relaxed text-slate-ink">
                If WIPEG played a part in where you are now, write it in your
                own words. We publish testimonials as they were written, with
                your name and what you do today.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <ul className="mt-8 flex flex-col gap-3">
                {[
                  "Write it yourself — we don't rewrite your words.",
                  "Nothing appears on the site until you have agreed to it.",
                  "The registry checks each one before it is published.",
                ].map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-3 text-[0.9rem] leading-relaxed text-ink/85"
                  >
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-500 text-white">
                      <Check className="size-3" strokeWidth={3.5} />
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <Reveal direction="left" delay={0.1}>
            <div className="rounded-[1.75rem] border border-brand-900/8 bg-white p-7 sm:p-9">
              <TestimonialForm />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------- CTA ---------------------------- */}
      <section className="bg-white pb-24 lg:pb-32">
        <div className="container-page">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-800 via-brand-900 to-ink px-7 py-14 text-center text-white sm:rounded-[2.5rem] sm:px-14 lg:py-20">
              <GlowField variant="section" />

              <div className="relative mx-auto max-w-2xl">
                <Eyebrow tone="dark">Your turn</Eyebrow>
                <h2 className="mt-5 text-[2rem] font-extrabold leading-[1.12] sm:text-[2.6rem]">
                  Start the programme they started
                </h2>
                <p className="mt-5 text-[0.98rem] leading-relaxed text-white/65">
                  Admissions are open across all ten departments, at the{" "}
                  {school.campus.city} main campus and every branch.
                </p>

                <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
                  <Button href="/admissions" variant="accent" size="lg">
                    Apply Now
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
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
