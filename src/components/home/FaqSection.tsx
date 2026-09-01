import Image from "next/image";
import { Play } from "lucide-react";

import { faqs } from "@/data/site";
import { Accordion } from "@/components/ui/Accordion";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Reveal } from "@/components/ui/Reveal";

export function FaqSection() {
  return (
    <section className="bg-white py-24 lg:py-32">
      <div className="container-page grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
        {/* Offset frame around the image, straight from the reference */}
        <Reveal direction="right" className="relative">
          <span
            aria-hidden
            className="absolute -left-4 -top-4 bottom-8 right-8 rounded-[1.75rem] bg-brand-800"
          />
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] shadow-[var(--shadow-lift)]">
            <Image
              src="/images/lecturer-programmes.jpg"
              alt="A WIPEG lecturer presenting the institute's programmes to students"
              fill
              sizes="(min-width: 1024px) 44vw, 92vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-ink/25" />
            <button
              type="button"
              className="group absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-white/95 py-2 pl-2 pr-5 shadow-[var(--shadow-lift)] backdrop-blur-sm transition-transform duration-300 hover:scale-105"
            >
              <span className="relative grid size-9 place-items-center rounded-full bg-accent-500 text-white">
                <span className="animate-pulse-ring absolute inset-0 rounded-full bg-accent-500/60" />
                <Play className="relative size-3.5 translate-x-px fill-current" />
              </span>
              <span className="text-[0.82rem] font-bold text-ink">
                Campus tour
              </span>
            </button>
          </div>
        </Reveal>

        <div>
          <Reveal>
            <Eyebrow>Questions</Eyebrow>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink sm:text-[2.7rem]">
              Frequently asked questions
            </h2>
          </Reveal>
          <Reveal delay={0.14} className="mt-9">
            <Accordion items={faqs} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
