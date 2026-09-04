"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, GraduationCap, MapPin, Play } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { GlowField } from "@/components/ui/GlowField";
import { WordReveal } from "@/components/ui/WordReveal";
import { branches, school, totalCourses } from "@/data/site";

const SLIDE_MS = 7000;

const slides = [
  {
    eyebrow: "Higher & Vocational Education",
    title: "Professionalism and Excellent Growth",
    highlight: ["Excellent", "Growth"],
    body: `HND and BTS diplomas, Bachelors and Masters degrees, vocational training and IT certifications — taught at our Garoua main campus under authorisation N° ${school.authNumber.split("/")[0]}.`,
    image: "/images/real-hero-portrait.jpg",
    alt: "WIPEG graduands at the institute's graduation ceremony",
  },
  {
    eyebrow: "Ten Academic Departments",
    title: "Build the Career Cameroon Is Hiring For",
    highlight: ["Hiring", "For"],
    body: `From nursing and laboratory science to full-stack development, agropastoral enterprise and mining engineering — ${totalCourses} programmes across ten departments.`,
    image: "/images/hero-2.jpg",
    alt: "WIPEG students studying together in the library",
  },
  {
    eyebrow: "Special Offer",
    title: "Free Driving and English Lessons Included",
    highlight: ["Free"],
    body: "Every WIPEG student gets free driving lessons with a Category B licence afterward, free English lessons with a certificate, moderate fees paid in installments, and access to scholarships.",
    image: "/images/hero-3.jpg",
    alt: "A WIPEG lecturer teaching a medical sciences class",
  },
];

export function Hero() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  const slide = slides[index];

  const go = useCallback((i: number) => setIndex((i + slides.length) % slides.length), []);

  useEffect(() => {
    if (paused || reduce) return;
    const t = setTimeout(() => go(index + 1), SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, paused, reduce, go]);

  return (
    <section
      className="relative -mt-[5.25rem] overflow-hidden rounded-b-[2rem] bg-ink pt-[5.25rem] text-white sm:rounded-b-[3rem]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <GlowField variant="hero" />

      {/* Decorative open-book arc echoing the WIPEG crest */}
      <svg
        aria-hidden
        viewBox="0 0 400 200"
        className="pointer-events-none absolute right-[6%] top-[12%] hidden w-64 text-gold-400/25 lg:block"
      >
        <path
          d="M20 160 C 90 100, 150 100, 200 150 C 250 100, 310 100, 380 160"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M20 130 C 90 70, 150 70, 200 120 C 250 70, 310 70, 380 130"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>

      <div className="container-page relative grid items-center gap-14 pb-24 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28 lg:pt-20">
        {/* -------------------------------- copy -------------------------- */}
        <div className="relative z-10">
          <motion.div
            key={`eyebrow-${index}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <Eyebrow tone="dark">{slide.eyebrow}</Eyebrow>
          </motion.div>

          <WordReveal
            key={`title-${index}`}
            text={slide.title}
            highlight={slide.highlight}
            className="mt-6 text-[2.6rem] font-extrabold leading-[1.06] sm:text-[3.4rem] lg:text-[4rem] xl:text-[4.4rem]"
          />

          <motion.p
            key={`body-${index}`}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-xl text-[0.98rem] leading-relaxed text-white/65"
          >
            {slide.body}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex flex-wrap items-center gap-4 sm:gap-6"
          >
            <Button href="/admissions" variant="gold" size="lg">
              Apply Now
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>

            <a href="#about" className="group flex items-center gap-3.5">
              <span className="relative grid size-12 place-items-center rounded-full bg-accent-500 text-white transition-transform duration-300 group-hover:scale-110">
                <span className="animate-pulse-ring absolute inset-0 rounded-full bg-accent-500/60" />
                <Play className="relative size-4 translate-x-px fill-current" />
              </span>
              <span className="text-[0.95rem] font-semibold text-white/85 transition-colors group-hover:text-white">
                How WIPEG Works
              </span>
            </a>
          </motion.div>

          {/* Award levels — verbatim from the flier's blue band */}
          <motion.ul
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.66, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 flex flex-wrap gap-2"
          >
            {school.awards.map((a) => (
              <li
                key={a}
                className="rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-[0.72rem] font-semibold tracking-wide text-white/70 backdrop-blur-sm"
              >
                {a}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* ------------------------------- visual ------------------------- */}
        <div className="relative mx-auto w-full max-w-[26rem] lg:mr-0 lg:ml-auto lg:max-w-[27rem]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Soft halo behind the portrait */}
            <div
              className="absolute -inset-8 rounded-full opacity-70 blur-3xl"
              style={{
                background:
                  "radial-gradient(circle at 50% 45%, rgba(46,86,232,0.55), transparent 66%)",
              }}
              aria-hidden
            />

            <div className="mask-leaf relative aspect-[4/5] overflow-hidden ring-1 ring-white/15">
              {/* No `mode="wait"` here: the slides are stacked absolutely, so
                  the incoming photo must cross-fade over the outgoing one.
                  Waiting for the exit first leaves the frame empty for ~0.9s
                  on every slide change. */}
              <AnimatePresence>
                <motion.div
                  key={slide.image}
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.04 }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0"
                >
                  <Image
                    src={slide.image}
                    alt={slide.alt}
                    fill
                    sizes="(min-width: 1024px) 40vw, 90vw"
                    className="object-cover"
                    priority={index === 0}
                  />
                </motion.div>
              </AnimatePresence>
              <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent" />
            </div>

            {/* Floating campus pill. This slot used to claim a student count
                that appears on none of the school's material — replaced with
                the branch network, which the posters do state. */}
            <motion.div
              initial={{ opacity: 0, x: -30, y: 20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="animate-float absolute -left-2 bottom-[16%] max-w-[13rem] rounded-2xl border border-white/12 bg-ink/80 p-3.5 shadow-[var(--shadow-lift)] backdrop-blur-xl sm:-left-8"
            >
              <p className="flex items-center gap-1.5 text-[0.78rem] font-bold text-white">
                <MapPin className="size-3.5 text-gold-400" />
                {branches.length} campuses
              </p>
              <p className="mt-1.5 text-[0.68rem] leading-snug text-white/60">
                {branches.map((b) => b.city).join(" · ")}
              </p>
            </motion.div>

            {/* Floating departments chip */}
            <motion.div
              initial={{ opacity: 0, x: 30, y: -20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.8, delay: 0.95, ease: [0.22, 1, 0.36, 1] }}
              className="animate-float absolute -right-2 top-[12%] flex items-center gap-2.5 rounded-2xl border border-white/12 bg-ink/80 px-4 py-3 shadow-[var(--shadow-lift)] backdrop-blur-xl sm:-right-6"
              style={{ animationDelay: "-2.5s" }}
            >
              <span className="grid size-9 place-items-center rounded-full bg-gold-400 text-ink">
                <GraduationCap className="size-4" />
              </span>
              <span className="leading-tight">
                <span className="block text-lg font-extrabold text-white">10</span>
                <span className="block text-[0.62rem] font-semibold uppercase tracking-wider text-white/55">
                  Departments
                </span>
              </span>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* ------------------------------ pagination ------------------------ */}
      <div className="container-page relative pb-16">
        <div className="flex items-center justify-center gap-4">
          {slides.map((s, i) => {
            const active = i === index;
            return (
              <button
                key={s.title}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={active}
                className="group flex items-center gap-4"
              >
                <span
                  className={`text-sm font-bold tabular-nums transition-colors duration-300 ${
                    active ? "text-gold-400" : "text-white/35 group-hover:text-white/70"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                {active && (
                  <span className="relative h-0.5 w-20 overflow-hidden rounded-full bg-white/15 sm:w-28">
                    <motion.span
                      key={`bar-${index}-${paused}`}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: paused || reduce ? 0.35 : 1 }}
                      transition={{
                        duration: paused || reduce ? 0.3 : SLIDE_MS / 1000,
                        ease: "linear",
                      }}
                      className="absolute inset-0 origin-left rounded-full bg-gold-400"
                    />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
