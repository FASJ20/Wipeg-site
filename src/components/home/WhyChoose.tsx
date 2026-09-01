import Image from "next/image";
import { ArrowRight, Sparkles } from "lucide-react";

import { advantages } from "@/data/site";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Icon } from "@/components/ui/Icon";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";

export function WhyChoose() {
  return (
    <section className="relative overflow-hidden bg-tint py-24 lg:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-1/4 size-[34rem] rounded-full bg-accent-100/50 blur-[120px]"
      />

      <div className="container-page relative grid items-start gap-16 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
        {/* ---------------------------- offer panel ----------------------- */}
        <div className="lg:sticky lg:top-28">
          <Reveal>
            <Eyebrow>Why choose WIPEG</Eyebrow>
          </Reveal>

          <Reveal delay={0.08}>
            <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink sm:text-[2.7rem]">
              More than a diploma — a start you can actually use
            </h2>
          </Reveal>

          <Reveal delay={0.14}>
            <p className="mt-5 text-[0.98rem] leading-relaxed text-slate-ink">
              WIPEG students leave with more than the certificate they enrolled
              for. Everything below is included with your programme, not sold on
              top of it.
            </p>
          </Reveal>

          {/* The flier's orange "Special Offer" box, rebuilt for the web */}
          <Reveal delay={0.2}>
            <div className="relative mt-9 overflow-hidden rounded-[1.5rem] bg-accent-500 p-7 text-white shadow-[var(--shadow-glow)]">
              <div
                aria-hidden
                className="absolute -right-8 -top-10 size-40 rounded-full bg-white/10"
              />
              <div
                aria-hidden
                className="absolute right-6 top-6 opacity-20"
                style={{
                  backgroundImage:
                    "radial-gradient(rgb(255 255 255 / 0.9) 1.5px, transparent 1.5px)",
                  backgroundSize: "12px 12px",
                  width: "84px",
                  height: "60px",
                }}
              />
              <p className="relative flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-white/85">
                <Sparkles className="size-3.5" />
                Special offer
              </p>
              <p className="relative mt-3 text-[1.35rem] font-extrabold leading-snug">
                Free driving lessons, a Category B licence and free English
                classes — included.
              </p>
              <p className="relative mt-3 text-[0.88rem] leading-relaxed text-white/80">
                Moderate fees, payable in installments. Scholarships available
                each intake.
              </p>
              <Button
                href="/admissions"
                variant="gold"
                className="relative mt-6"
              >
                See admission details
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </div>
          </Reveal>
        </div>

        {/* ------------------------------ cards --------------------------- */}
        <div>
          <RevealGroup className="grid gap-5 sm:grid-cols-2" stagger={0.09}>
            {advantages.map((a) => (
              <RevealItem
                key={a.title}
                className="group relative overflow-hidden rounded-[1.35rem] border border-brand-900/8 bg-white p-6 transition-all duration-500 ease-[var(--ease-out-quint)] hover:-translate-y-1.5 hover:border-accent-500/25 hover:shadow-[var(--shadow-lift)]"
              >
                <span
                  aria-hidden
                  className="absolute -right-10 -top-10 size-28 rounded-full bg-brand-50 transition-all duration-500 group-hover:scale-150 group-hover:bg-accent-50"
                />
                <span className="relative grid size-13 place-items-center rounded-2xl bg-brand-800 text-white transition-colors duration-500 group-hover:bg-accent-500">
                  <Icon name={a.icon} className="size-6" />
                </span>
                <p className="relative mt-5 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-accent-500">
                  {a.tag}
                </p>
                <h3 className="relative mt-1.5 text-[1.05rem] font-bold leading-snug text-ink">
                  {a.title}
                </h3>
                <p className="relative mt-2.5 text-[0.85rem] leading-relaxed text-slate-ink">
                  {a.body}
                </p>
              </RevealItem>
            ))}
          </RevealGroup>

          <Reveal delay={0.18} className="mt-6">
            <div className="relative overflow-hidden rounded-[1.35rem]">
              <div className="relative aspect-[16/9]">
                <Image
                  src="/images/lecturer-banner.jpg"
                  alt="A WIPEG lecturer teaching beside the institute's programme banner"
                  fill
                  sizes="(min-width: 1024px) 52vw, 92vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent" />
              </div>
              <p className="absolute bottom-5 left-6 right-6 text-[0.95rem] font-semibold leading-snug text-white">
                Taught on our Bamenda campus — Ntambessi, towards the first gate
                of PC Ntaghem.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
