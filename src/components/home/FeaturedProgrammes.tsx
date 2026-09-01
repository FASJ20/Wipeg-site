import { ArrowRight } from "lucide-react";

import { departments } from "@/data/site";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ProgrammeCard } from "@/components/ui/ProgrammeCard";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";

const featuredSlugs = [
  "medical-biomedical-sciences",
  "computer-engineering",
  "it-programs",
  "business-and-finance",
  "management",
  "agricultural-food-sciences",
];

export function FeaturedProgrammes() {
  const featured = featuredSlugs
    .map((s) => departments.find((d) => d.slug === s))
    .filter((d): d is (typeof departments)[number] => Boolean(d));

  return (
    <section className="bg-white py-24 lg:py-32">
      <div className="container-page">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow>Popular programmes</Eyebrow>
          <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink sm:text-[2.7rem]">
            The programmes students ask about most
          </h2>
          <p className="mt-5 text-[0.98rem] leading-relaxed text-slate-ink">
            Every department runs to the same standard — supervised practicals,
            lecturers who know the local job market, and a qualification
            recognised under our MINESUP authorisation.
          </p>
        </Reveal>

        <RevealGroup
          className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          stagger={0.08}
        >
          {featured.map((d) => (
            <RevealItem key={d.slug} className="h-full">
              <ProgrammeCard department={d} />
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal delay={0.1} className="mt-14 text-center">
          <Button href="/programmes" variant="outline" size="lg">
            Browse all ten departments
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
