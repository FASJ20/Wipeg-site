"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { Quote } from "lucide-react";
import { useEffect, useState } from "react";

import { testimonials } from "@/data/site";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { GlowField } from "@/components/ui/GlowField";
import { Reveal } from "@/components/ui/Reveal";

/** "Fai Arnold" -> "FA". Used in place of a portrait until real, consented
    photographs exist — a named person should never wear a stock face. */
function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function Testimonials() {
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
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow tone="dark">Testimonials</Eyebrow>
          <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] sm:text-[2.7rem]">
            What our graduates say
          </h2>
        </Reveal>

        <Reveal delay={0.12} className="mx-auto mt-12 max-w-3xl">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur-sm sm:p-12">
            <Quote className="mx-auto size-10 fill-gold-400 text-gold-400" />

            <AnimatePresence mode="wait">
              <motion.blockquote
                key={t.name}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="mt-7"
              >
                <p className="text-[1.05rem] leading-relaxed text-white/85 sm:text-[1.2rem]">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <footer className="mt-8">
                  <p className="text-[1rem] font-bold text-white">{t.name}</p>
                  <p className="mt-1 text-[0.8rem] text-gold-400">{t.role}</p>
                </footer>
              </motion.blockquote>
            </AnimatePresence>

            {/* Picker — monograms, or the real portrait once one is supplied */}
            <div className="mt-9 flex justify-center gap-3">
              {testimonials.map((item, idx) => {
                const active = idx === i;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setI(idx)}
                    aria-label={`Read the testimonial from ${item.name}`}
                    aria-current={active}
                    className={`relative grid size-12 place-items-center overflow-hidden rounded-full text-[0.8rem] font-bold transition-all duration-400 ${
                      active
                        ? "scale-110 bg-gold-400 text-ink ring-2 ring-gold-400 ring-offset-2 ring-offset-ink"
                        : "bg-white/10 text-white/70 ring-1 ring-white/15 hover:bg-white/20 hover:text-white"
                    }`}
                  >
                    {item.photo ? (
                      <Image
                        src={item.photo}
                        alt=""
                        fill
                        sizes="48px"
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
        </Reveal>
      </div>
    </section>
  );
}
