"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { Quote } from "lucide-react";
import { useEffect, useState } from "react";

import { testimonials } from "@/data/site";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { GlowField } from "@/components/ui/GlowField";
import { Reveal } from "@/components/ui/Reveal";

/** "Fai Arnold" -> "FA". Stands in for a portrait until real, consented
    photographs exist — a named person should never wear a stock face. */
function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function Testimonials({ showHeading = true }: { showHeading?: boolean }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const t = testimonials[i];

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(
      () => setI((n) => (n + 1) % testimonials.length),
      9000,
    );
    return () => clearTimeout(timer);
  }, [i, paused]);

  return (
    <section
      className="relative overflow-hidden rounded-[2rem] bg-ink py-20 text-white sm:rounded-[3rem] lg:py-24"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <GlowField variant="section" />

      <div className="container-page relative">
        {showHeading && (
          <>
            <Reveal>
              <Eyebrow tone="dark">Testimonials</Eyebrow>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-5 max-w-lg text-[2.1rem] font-extrabold leading-[1.12] sm:text-[2.7rem]">
                What our graduates say
              </h2>
            </Reveal>
          </>
        )}

        <Reveal delay={0.14} className={showHeading ? "mt-12" : ""}>
          <div className="grid items-stretch gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            {/* ---------------------------- quote card -------------------- */}
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm sm:p-10">
              <Quote className="size-9 fill-gold-400 text-gold-400" />

              <AnimatePresence mode="wait">
                <motion.blockquote
                  key={t.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-6"
                >
                  <p className="text-[1.05rem] leading-relaxed text-white/85 sm:text-[1.15rem]">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <footer className="mt-7">
                    <p className="text-[0.95rem] font-bold text-white">{t.name}</p>
                    <p className="mt-0.5 text-[0.78rem] text-gold-400">{t.role}</p>
                  </footer>
                </motion.blockquote>
              </AnimatePresence>

              {/* Picker — monograms, or the real portrait once one is supplied */}
              <div className="mt-8 flex gap-3">
                {testimonials.map((item, idx) => {
                  const active = idx === i;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => setI(idx)}
                      aria-label={`Read the testimonial from ${item.name}`}
                      aria-current={active}
                      className={`relative grid size-11 place-items-center overflow-hidden rounded-full text-[0.78rem] font-bold transition-all duration-400 ${
                        active
                          ? "scale-110 bg-gold-400 text-ink ring-2 ring-gold-400 ring-offset-2 ring-offset-ink"
                          : "bg-white/10 text-white/60 ring-1 ring-white/15 hover:bg-white/20 hover:text-white"
                      }`}
                    >
                      {item.photo ? (
                        <Image
                          src={item.photo}
                          alt=""
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      ) : (
                        initials(item.name)
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ------------------------ campus imagery -------------------- */}
            {/* A fixed graduation photograph, captioned, rather than one that
                changes with the quote — a rotating face would read as the
                person speaking, and we have no consented portraits. */}
            <div className="relative min-h-[18rem] overflow-hidden rounded-[1.75rem] border border-white/10">
              <Image
                src="/images/real-graduands.jpg"
                alt="WIPEG graduands at the institute's graduation ceremony"
                fill
                sizes="(min-width: 1024px) 30vw, 92vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent" />
              <p className="absolute inset-x-5 bottom-5 text-[0.72rem] font-semibold leading-snug text-white/80">
                Graduation day at the {""}
                <span className="text-gold-400">Garoua main campus</span>
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
