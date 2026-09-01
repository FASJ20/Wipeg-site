import Image from "next/image";

import { lecturers } from "@/data/site";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";

export function Lecturers() {
  return (
    <section className="bg-white py-24 lg:py-32">
      <div className="container-page">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow>Our team</Eyebrow>
          <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink sm:text-[2.7rem]">
            Led by heads of department who teach
          </h2>
          <p className="mt-5 text-[0.98rem] leading-relaxed text-slate-ink">
            Each department is run by a lecturer who still takes classes — so
            the person setting the syllabus is the person in the room with you.
          </p>
        </Reveal>

        <RevealGroup
          className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          stagger={0.08}
        >
          {lecturers.map((l) => (
            <RevealItem key={l.name}>
              <article className="group relative overflow-hidden rounded-[1.35rem] bg-tint-warm transition-all duration-500 ease-[var(--ease-out-quint)] hover:-translate-y-2 hover:shadow-[var(--shadow-lift)]">
                <div className="relative aspect-[4/5] overflow-hidden">
                  <Image
                    src={l.image}
                    alt={l.name}
                    fill
                    sizes="(min-width: 1024px) 24vw, (min-width: 640px) 45vw, 92vw"
                    className="object-cover grayscale-[0.35] transition-all duration-[900ms] ease-[var(--ease-out-quint)] group-hover:scale-108 group-hover:grayscale-0"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/70 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </div>

                <div className="relative px-5 py-5 text-center">
                  <h3 className="text-[0.98rem] font-bold text-ink transition-colors duration-300 group-hover:text-brand-800">
                    {l.name}
                  </h3>
                  <p className="mt-1 text-[0.75rem] leading-snug text-slate-ink/75">
                    {l.role}
                  </p>
                  <span
                    aria-hidden
                    className="mx-auto mt-3 block h-0.5 w-0 rounded-full bg-accent-500 transition-all duration-500 group-hover:w-10"
                  />
                </div>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
