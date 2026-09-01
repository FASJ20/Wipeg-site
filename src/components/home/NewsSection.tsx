import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, UserRound } from "lucide-react";

import { news } from "@/data/site";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";

export function NewsSection() {
  return (
    <section className="bg-tint py-24 lg:py-32">
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <Reveal>
              <Eyebrow>News &amp; updates</Eyebrow>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink sm:text-[2.7rem]">
                Latest from the campus
              </h2>
            </Reveal>
          </div>
        </div>

        <RevealGroup
          className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          stagger={0.09}
        >
          {news.map((n) => (
            <RevealItem key={n.slug}>
              <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.35rem] bg-white shadow-[var(--shadow-card)] transition-all duration-500 ease-[var(--ease-out-quint)] hover:-translate-y-2 hover:shadow-[var(--shadow-lift)]">
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={n.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
                    className="object-cover transition-transform duration-[900ms] ease-[var(--ease-out-quint)] group-hover:scale-110"
                  />
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <span className="w-fit rounded-full bg-gold-400 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-wider text-ink">
                    {n.category}
                  </span>

                  <h3 className="mt-3.5 text-[1.02rem] font-bold leading-snug text-ink">
                    <Link
                      href="/contact"
                      className="bg-gradient-to-r from-accent-500 to-accent-500 bg-[length:0%_2px] bg-left-bottom bg-no-repeat transition-[background-size] duration-500 group-hover:bg-[length:100%_2px]"
                    >
                      {n.title}
                    </Link>
                  </h3>

                  <p className="mt-2.5 flex-1 text-[0.85rem] leading-relaxed text-slate-ink">
                    {n.excerpt}
                  </p>

                  <div className="mt-5 flex items-center justify-between border-t border-brand-900/8 pt-4 text-[0.72rem] font-medium text-slate-ink/70">
                    <span className="flex items-center gap-1.5">
                      <UserRound className="size-3.5 text-accent-500" />
                      {n.author}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5 text-accent-500" />
                      {n.date}
                    </span>
                  </div>
                </div>

                <span
                  aria-hidden
                  className="pointer-events-none absolute right-5 top-5 grid size-9 translate-y-2 place-items-center rounded-full bg-white text-brand-800 opacity-0 transition-all duration-400 group-hover:translate-y-0 group-hover:opacity-100"
                >
                  <ArrowUpRight className="size-4" />
                </span>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
