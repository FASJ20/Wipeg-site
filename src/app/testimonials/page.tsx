import type { Metadata } from "next";
import { ArrowRight, Phone } from "lucide-react";

import { PageHero } from "@/components/site/PageHero";
import { Testimonials } from "@/components/home/Testimonials";
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
      />

      {/* The same section the home page uses, minus its duplicate heading.
          No container-page wrapper here — the component brings its own, and
          nesting the two double-pads the content. */}
      <div className="bg-white pt-20 lg:pt-24">
        <Testimonials showHeading={false} />
      </div>

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
