import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Counter } from "@/components/ui/Counter";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { school, stats } from "@/data/site";

const pillars = [
  "Ten departments under one authorised roof",
  "Lecturers who stay until the practical actually works",
  "Progression routes into partner universities",
];

export function AboutIntro() {
  return (
    <section id="about" className="relative overflow-hidden bg-white py-24 lg:py-32">
      <div className="container-page grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
        {/* ------------------------------ visuals ------------------------- */}
        <Reveal direction="right" className="relative">
          <div className="relative aspect-[5/4] w-full overflow-hidden rounded-[2rem] shadow-[var(--shadow-lift)]">
            <Image
              src="/images/real-ceremony.jpg"
              alt="The head table at a WIPEG graduation ceremony in Garoua"
              fill
              sizes="(min-width: 1024px) 44vw, 92vw"
              className="object-cover"
            />
          </div>

          {/* Overlapping secondary image, mirroring the reference layout */}
          <div className="absolute -bottom-10 -right-4 hidden aspect-square w-44 overflow-hidden rounded-[1.5rem] border-[6px] border-white shadow-[var(--shadow-lift)] sm:block lg:-right-8 lg:w-52">
            <Image
              src="/images/real-capping.jpg"
              alt="A WIPEG graduand being capped"
              fill
              sizes="220px"
              className="object-cover"
            />
          </div>

          {/* Rotating seal — the gold badge from the reference, carrying the
              WIPEG motto instead of a years-of-experience count. */}
          <div className="absolute -top-8 left-0 size-28 sm:-left-5 sm:size-32 lg:-left-10 lg:size-36">
            <div className="animate-spin-slow absolute inset-0">
              <svg viewBox="0 0 200 200" className="size-full">
                <defs>
                  <path
                    id="badge-arc"
                    d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0"
                    fill="none"
                  />
                </defs>
                <text
                  className="fill-brand-900 text-[19px] font-bold uppercase"
                  style={{ letterSpacing: "0.14em" }}
                >
                  <textPath href="#badge-arc" startOffset="0">
                    Professionalism • Excellent Growth •
                  </textPath>
                </text>
              </svg>
            </div>
            <div className="absolute inset-[19%] grid place-items-center rounded-full bg-gold-400 text-center shadow-[0_16px_32px_-16px_rgb(240_169_29/0.9)]">
              <span className="px-2 text-[0.58rem] font-extrabold uppercase leading-tight tracking-wider text-ink">
                MINESUP
                <br />
                Accredited
              </span>
            </div>
          </div>
        </Reveal>

        {/* ------------------------------- copy --------------------------- */}
        <div>
          <Reveal>
            <Eyebrow>About WIPEG</Eyebrow>
          </Reveal>

          <Reveal delay={0.08}>
            <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink sm:text-[2.7rem]">
              Empowering Cameroon&rsquo;s next generation of{" "}
              <span className="relative whitespace-nowrap text-brand-800">
                professionals
                <svg
                  aria-hidden
                  viewBox="0 0 300 14"
                  className="absolute -bottom-1 left-0 w-full text-accent-500"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 9 C 70 2, 150 2, 298 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h2>
          </Reveal>

          <Reveal delay={0.14}>
            <p className="mt-6 text-[0.98rem] leading-relaxed text-slate-ink">
              The {school.name} runs its main campus in Garoua,
              operating under authorisation N° {school.authNumber} and affiliated
              to the {school.ministry}. We award HND and BTS diplomas, Bachelors
              and Masters degrees, vocational qualifications and IT
              certifications — and we back every student with free driving and
              English lessons, fees payable in installments, and scholarships.
            </p>
          </Reveal>

          <RevealGroup className="mt-7 flex flex-col gap-3" delay={0.2}>
            {pillars.map((p) => (
              <RevealItem
                key={p}
                as="p"
                className="flex items-start gap-3 text-[0.92rem] font-medium text-ink/85"
              >
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-500 text-white">
                  <Check className="size-3" strokeWidth={3.5} />
                </span>
                {p}
              </RevealItem>
            ))}
          </RevealGroup>

          {/* Counters */}
          <RevealGroup
            className="mt-10 grid grid-cols-2 gap-x-6 gap-y-7 border-t border-brand-900/8 pt-8 sm:grid-cols-4"
            delay={0.1}
          >
            {stats.map((s) => (
              <RevealItem key={s.label}>
                <p className="text-[2rem] font-extrabold leading-none text-brand-800">
                  <Counter value={s.value} suffix={s.suffix} />
                </p>
                <p className="mt-2 text-[0.74rem] font-medium leading-snug text-slate-ink/80">
                  {s.label}
                </p>
              </RevealItem>
            ))}
          </RevealGroup>

          <Reveal delay={0.16} className="mt-10">
            <Button href="/about" variant="brand" size="lg">
              More about the institute
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
