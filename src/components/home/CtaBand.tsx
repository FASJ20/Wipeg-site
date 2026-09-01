import { ArrowRight, Phone } from "lucide-react";

import { school } from "@/data/site";
import { Button } from "@/components/ui/Button";
import { GlowField } from "@/components/ui/GlowField";
import { Reveal } from "@/components/ui/Reveal";

export function CtaBand() {
  return (
    <section className="bg-white pb-24 lg:pb-28">
      <div className="container-page">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-800 via-brand-900 to-ink px-7 py-14 text-center text-white sm:rounded-[2.5rem] sm:px-14 lg:py-20">
            <GlowField variant="section" />

            <div className="relative mx-auto max-w-2xl">
              <p className="eyebrow justify-center text-gold-400">
                <span className="inline-block size-1.5 rounded-full bg-gold-400" />
                Admissions are open
              </p>
              <h2 className="mt-5 text-[2rem] font-extrabold leading-[1.12] sm:text-[2.6rem]">
                Start your programme at WIPEG this intake
              </h2>
              <p className="mt-5 text-[0.98rem] leading-relaxed text-white/65">
                Choose from {school.awards.join(", ")} across ten departments.
                Speak to the registry, or apply online and we will call you
                back.
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
  );
}
