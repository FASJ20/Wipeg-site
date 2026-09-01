"use client";

import Image from "next/image";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";

import { departments } from "@/data/site";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { GlowField } from "@/components/ui/GlowField";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";

export function DepartmentCarousel() {
  const [emblaRef, embla] = useEmblaCarousel({
    align: "start",
    loop: true,
    dragFree: true,
    containScroll: "trimSnaps",
  });
  // The carousel loops, so both directions start available. Embla's own events
  // keep these honest if `loop` is ever turned off — subscribing to an external
  // system and setting state from its callback is the correct effect shape,
  // whereas calling the sync fn in the effect body cascades a render.
  const [canPrev, setCanPrev] = useState(true);
  const [canNext, setCanNext] = useState(true);

  useEffect(() => {
    if (!embla) return;

    const sync = () => {
      setCanPrev(embla.canScrollPrev());
      setCanNext(embla.canScrollNext());
    };

    embla.on("select", sync).on("reInit", sync);
    return () => {
      embla.off("select", sync).off("reInit", sync);
    };
  }, [embla]);

  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-ink py-20 text-white sm:rounded-[3rem] lg:py-24">
      <GlowField variant="section" />

      <div className="container-page relative">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Reveal>
              <Eyebrow tone="dark">Departments</Eyebrow>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-5 max-w-xl text-[2.1rem] font-extrabold leading-[1.12] sm:text-[2.7rem]">
                Ten departments. One standard of training.
              </h2>
            </Reveal>
          </div>

          <Reveal delay={0.12} className="flex gap-3">
            <button
              type="button"
              aria-label="Previous departments"
              onClick={() => embla?.scrollPrev()}
              disabled={!canPrev}
              className="grid size-12 place-items-center rounded-full border border-white/15 text-white/75 transition-all duration-300 hover:border-accent-500 hover:bg-accent-500 hover:text-white disabled:opacity-30 disabled:hover:border-white/15 disabled:hover:bg-transparent"
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next departments"
              onClick={() => embla?.scrollNext()}
              disabled={!canNext}
              className="grid size-12 place-items-center rounded-full border border-white/15 text-white/75 transition-all duration-300 hover:border-accent-500 hover:bg-accent-500 hover:text-white disabled:opacity-30"
            >
              <ArrowRight className="size-4" />
            </button>
          </Reveal>
        </div>
      </div>

      {/* Carousel — bleeds past the container on the right like the reference */}
      <Reveal delay={0.16} className="relative mt-12">
        <div className="container-page">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-5">
              {departments.map((d) => (
                <Link
                  key={d.slug}
                  href={`/programmes/${d.slug}`}
                  className="group relative h-[19rem] w-[15.5rem] shrink-0 overflow-hidden rounded-[1.5rem] sm:w-[17rem]"
                >
                  <Image
                    src={d.image}
                    alt=""
                    fill
                    sizes="272px"
                    className="object-cover transition-transform duration-[900ms] ease-[var(--ease-out-quint)] group-hover:scale-110"
                  />

                  {/* Base scrim, replaced by the gold wash on hover */}
                  <span className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/10 transition-opacity duration-500 group-hover:opacity-0" />
                  <span className="absolute inset-0 bg-gradient-to-t from-accent-600/95 via-accent-500/70 to-gold-400/25 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                  <span className="relative flex h-full flex-col justify-between p-5">
                    <span className="grid size-11 place-items-center rounded-full bg-white/12 text-white ring-1 ring-white/20 backdrop-blur-sm transition-colors duration-500 group-hover:bg-white group-hover:text-accent-500">
                      <Icon name={d.icon} className="size-5" />
                    </span>

                    <span>
                      <span className="block text-[1.05rem] font-bold leading-snug">
                        {d.name}
                      </span>
                      <span className="mt-1.5 flex items-center gap-2 text-[0.75rem] font-semibold text-white/70 transition-colors duration-500 group-hover:text-white/90">
                        {d.courses.length} programmes
                        <ArrowUpRight className="size-3.5 -translate-x-1 opacity-0 transition-all duration-400 group-hover:translate-x-0 group-hover:opacity-100" />
                      </span>
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
