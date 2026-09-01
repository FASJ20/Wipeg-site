import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, Check, Clock, GraduationCap, Layers } from "lucide-react";

import { PageHero } from "@/components/site/PageHero";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Icon } from "@/components/ui/Icon";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { advantages, departments, entryRequirements, school } from "@/data/site";

export function generateStaticParams() {
  return departments.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const d = departments.find((x) => x.slug === slug);
  if (!d) return { title: "Department not found" };
  return {
    title: d.name,
    description: `${d.name} at WIPEG Bamenda — ${d.courses.join(", ")}. ${d.blurb}`,
  };
}

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dept = departments.find((d) => d.slug === slug);
  if (!dept) notFound();

  const others = departments.filter((d) => d.slug !== slug).slice(0, 3);

  const facts = [
    { icon: Clock, label: "Duration", value: dept.duration },
    { icon: GraduationCap, label: "Study mode", value: dept.mode },
    { icon: Layers, label: "Programmes", value: `${dept.courses.length} on offer` },
  ];

  return (
    <>
      <PageHero
        eyebrow={dept.short}
        title={dept.name}
        intro={dept.blurb}
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Programmes", href: "/programmes" },
          { label: dept.short },
        ]}
      >
        <div className="flex flex-wrap justify-center gap-2">
          {dept.levels.map((l) => (
            <span
              key={l}
              className="rounded-full bg-gold-400 px-3.5 py-1.5 text-[0.72rem] font-bold uppercase tracking-wide text-ink"
            >
              {l}
            </span>
          ))}
        </div>
      </PageHero>

      <section className="bg-white py-20 lg:py-28">
        <div className="container-page grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          {/* ------------------------------ main ------------------------- */}
          <div>
            <Reveal>
              <div className="relative aspect-[16/9] overflow-hidden rounded-[1.75rem] shadow-[var(--shadow-lift)]">
                <Image
                  src={dept.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 58vw, 92vw"
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent" />
                <span className="absolute bottom-6 left-6 grid size-14 place-items-center rounded-2xl bg-white text-brand-800">
                  <Icon name={dept.icon} className="size-7" />
                </span>
              </div>
            </Reveal>

            <RevealGroup className="mt-8 grid gap-4 sm:grid-cols-3">
              {facts.map(({ icon: Ico, label, value }) => (
                <RevealItem
                  key={label}
                  className="rounded-2xl border border-brand-900/8 bg-tint/60 p-5"
                >
                  <Ico className="size-5 text-accent-500" />
                  <p className="mt-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-ink/60">
                    {label}
                  </p>
                  <p className="mt-1 text-[0.95rem] font-bold text-ink">{value}</p>
                </RevealItem>
              ))}
            </RevealGroup>

            <Reveal className="mt-12">
              <Eyebrow>Programmes offered</Eyebrow>
              <h2 className="mt-5 text-[1.8rem] font-extrabold leading-[1.15] text-ink sm:text-[2.1rem]">
                What you can study in {dept.short}
              </h2>
            </Reveal>

            <RevealGroup className="mt-8 grid gap-3 sm:grid-cols-2" stagger={0.06}>
              {dept.courses.map((c) => (
                <RevealItem
                  key={c}
                  className="group flex items-start gap-3 rounded-2xl border border-brand-900/8 bg-white p-4 transition-all duration-400 hover:-translate-y-1 hover:border-accent-500/30 hover:shadow-[var(--shadow-card)]"
                >
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-800 text-white transition-colors duration-400 group-hover:bg-accent-500">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  <span className="text-[0.9rem] font-semibold leading-snug text-ink">
                    {c}
                  </span>
                </RevealItem>
              ))}
            </RevealGroup>

            <Reveal className="mt-12">
              <Eyebrow>Entry requirements</Eyebrow>
              <h2 className="mt-5 text-[1.8rem] font-extrabold leading-[1.15] text-ink sm:text-[2.1rem]">
                What you need to apply
              </h2>
              {/* 🔶 PLACEHOLDER — confirm with the WIPEG registry */}
              <ul className="mt-6 flex flex-col gap-3">
                {entryRequirements.map((r) => (
                  <li
                    key={r}
                    className="flex items-start gap-3 text-[0.92rem] leading-relaxed text-slate-ink"
                  >
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-500" />
                    {r}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* ----------------------------- sidebar ----------------------- */}
          <aside className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
            <Reveal direction="left">
              <div className="rounded-[1.5rem] bg-gradient-to-br from-brand-800 to-ink p-7 text-white shadow-[var(--shadow-lift)]">
                <h2 className="text-[1.25rem] font-extrabold leading-snug">
                  Apply to {dept.short}
                </h2>
                <p className="mt-3 text-[0.88rem] leading-relaxed text-white/65">
                  Admissions are open for this intake. Speak to the registry or
                  send an enquiry and we&rsquo;ll call you back.
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <Button href="/admissions" variant="accent" className="w-full">
                    Start your application
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Button>
                  <Button
                    href={`tel:${school.phones[0].replace(/\s/g, "")}`}
                    variant="ghost-light"
                    className="w-full"
                  >
                    {school.phones[0]}
                  </Button>
                </div>
              </div>
            </Reveal>

            <Reveal direction="left" delay={0.08}>
              <div className="rounded-[1.5rem] border border-brand-900/8 bg-tint/60 p-7">
                <h2 className="text-[1.05rem] font-extrabold text-ink">
                  Included with your programme
                </h2>
                <ul className="mt-5 flex flex-col gap-4">
                  {advantages.map((a) => (
                    <li key={a.title} className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-accent-500">
                        <Icon name={a.icon} className="size-4" />
                      </span>
                      <span className="text-[0.85rem] font-semibold leading-snug text-ink">
                        {a.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal direction="left" delay={0.14}>
              <div className="rounded-[1.5rem] border border-brand-900/8 p-7">
                <h2 className="text-[1.05rem] font-extrabold text-ink">
                  Other departments
                </h2>
                <ul className="mt-5 flex flex-col gap-1">
                  {others.map((o) => (
                    <li key={o.slug}>
                      <Link
                        href={`/programmes/${o.slug}`}
                        className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[0.88rem] font-medium text-slate-ink transition-colors hover:bg-brand-50 hover:text-brand-800"
                      >
                        {o.short}
                        <ArrowUpRight className="size-4 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/programmes"
                  className="mt-4 inline-flex items-center gap-2 px-3 text-[0.85rem] font-bold text-accent-500"
                >
                  All ten departments
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </Reveal>
          </aside>
        </div>
      </section>
    </>
  );
}
