"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { Quote, Star } from "lucide-react";
import { useEffect, useState } from "react";

import { testimonials } from "@/data/site";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { GlowField } from "@/components/ui/GlowField";
import { Reveal } from "@/components/ui/Reveal";

export function Testimonials() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const t = testimonials[i];

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(
      () => setI((n) => (n + 1) % testimonials.length),
      8000,
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
        <Reveal>
          <Eyebrow tone="dark">Testimonials</Eyebrow>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="mt-5 max-w-lg text-[2.1rem] font-extrabold leading-[1.12] sm:text-[2.7rem]">
            What our students say
          </h2>
        </Reveal>

        <Reveal delay={0.14} className="mt-12">
          <div className="grid items-stretch gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            {/* Quote card */}
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm sm:p-10">
              <Quote className="size-9 fill-gold-400 text-gold-400" />

              <div className="mt-5 flex gap-1" aria-label="Five out of five">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className="size-4 fill-gold-400 text-gold-400" />
                ))}
              </div>

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
                    <p className="mt-0.5 text-[0.78rem] text-white/50">{t.role}</p>
                  </footer>
                </motion.blockquote>
              </AnimatePresence>

              {/* Avatar picker */}
              <div className="mt-8 flex gap-3">
                {testimonials.map((item, idx) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setI(idx)}
                    aria-label={`Read the testimonial from ${item.name}`}
                    aria-current={idx === i}
                    className={`relative size-11 overflow-hidden rounded-full transition-all duration-400 ${
                      idx === i
                        ? "scale-110 ring-2 ring-gold-400 ring-offset-2 ring-offset-ink"
                        : "opacity-50 grayscale hover:opacity-90 hover:grayscale-0"
                    }`}
                  >
                    <Image
                      src={item.image}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Portrait */}
            <div className="relative min-h-[18rem] overflow-hidden rounded-[1.75rem] border border-white/10">
              {/* Stacked portraits cross-fade — see the note in Hero.tsx. */}
              <AnimatePresence>
                <motion.div
                  key={t.image}
                  initial={{ opacity: 0, scale: 1.08 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0"
                >
                  <Image
                    src={t.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 30vw, 92vw"
                    className="object-cover"
                  />
                </motion.div>
              </AnimatePresence>
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
