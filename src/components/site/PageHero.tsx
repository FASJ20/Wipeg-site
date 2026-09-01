import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { Eyebrow } from "@/components/ui/Eyebrow";
import { GlowField } from "@/components/ui/GlowField";
import { Reveal } from "@/components/ui/Reveal";

/** Compact dark banner shared by every page other than the home page. */
export function PageHero({
  eyebrow,
  title,
  intro,
  breadcrumb,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  breadcrumb: { label: string; href?: string }[];
  children?: ReactNode;
}) {
  return (
    <section className="relative -mt-[5.25rem] overflow-hidden rounded-b-[2rem] bg-ink pt-[5.25rem] text-white sm:rounded-b-[3rem]">
      <GlowField variant="hero" />

      {/* There is no artwork in this banner, so the column is centred rather
          than left-aligned against an empty right half. */}
      <div className="container-page relative py-16 text-center lg:py-24">
        <Reveal>
          <Eyebrow tone="dark">{eyebrow}</Eyebrow>
        </Reveal>

        <Reveal delay={0.08}>
          <h1 className="mx-auto mt-6 max-w-3xl text-[2.4rem] font-extrabold leading-[1.08] sm:text-[3.1rem] lg:text-[3.6rem]">
            {title}
          </h1>
        </Reveal>

        {intro && (
          <Reveal delay={0.14}>
            <p className="mx-auto mt-6 max-w-2xl text-[1rem] leading-relaxed text-white/65">
              {intro}
            </p>
          </Reveal>
        )}

        {children && (
          <Reveal delay={0.2} className="mt-9 flex justify-center">
            {children}
          </Reveal>
        )}

        <Reveal delay={0.26}>
          <nav
            aria-label="Breadcrumb"
            className="mt-10 flex flex-wrap items-center justify-center gap-1.5 text-[0.8rem] text-white/45"
          >
            {breadcrumb.map((c, i) => (
              <span key={c.label} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="size-3.5 text-white/25" />}
                {c.href ? (
                  <Link href={c.href} className="transition-colors hover:text-gold-400">
                    {c.label}
                  </Link>
                ) : (
                  <span className="font-semibold text-white/80">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        </Reveal>
      </div>
    </section>
  );
}
