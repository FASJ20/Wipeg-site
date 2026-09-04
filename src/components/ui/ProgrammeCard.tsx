import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock, GraduationCap, Layers } from "lucide-react";

import type { Department } from "@/data/site";

/**
 * The course card from the reference template, adapted for a school that
 * publishes programmes rather than priced online courses: the price slot
 * carries the award level instead.
 */
export function ProgrammeCard({
  department,
  course,
}: {
  department: Department;
  course?: string;
}) {
  const title = course ?? department.name;
  const href = `/programmes/${department.slug}`;

  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-brand-900/8 bg-white shadow-[var(--shadow-card)] transition-all duration-500 ease-[var(--ease-out-quint)] hover:-translate-y-2 hover:border-brand-800/15 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={department.image}
          alt=""
          fill
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
          className="object-cover transition-transform duration-[900ms] ease-[var(--ease-out-quint)] group-hover:scale-110"
        />
        <span className="absolute left-3.5 top-3.5 rounded-full bg-white/95 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-brand-800 backdrop-blur-sm">
          {department.short}
        </span>
        <span className="absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap gap-1.5">
          {department.levels.map((l) => (
            <span
              key={l}
              className="rounded-full bg-brand-50 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wide text-brand-700"
            >
              {l}
            </span>
          ))}
        </div>

        <h3 className="mt-3 text-[1.02rem] font-bold leading-snug text-ink transition-colors duration-300 group-hover:text-brand-800">
          <span className="bg-gradient-to-r from-accent-500 to-accent-500 bg-[length:0%_2px] bg-left-bottom bg-no-repeat transition-[background-size] duration-500 group-hover:bg-[length:100%_2px]">
            {title}
          </span>
        </h3>

        <ul className="mt-4 mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.72rem] font-medium text-slate-ink/75">
          <li className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-accent-500" />
            {department.duration}
          </li>
          <li className="flex items-center gap-1.5">
            <Layers className="size-3.5 text-accent-500" />
            {department.courses.length} programmes
          </li>
          <li className="flex items-center gap-1.5">
            <GraduationCap className="size-3.5 text-accent-500" />
            {department.mode}
          </li>
        </ul>

        <div className="mt-auto flex items-center justify-between border-t border-brand-900/8 pt-4">
          <span className="text-[0.78rem] font-semibold text-slate-ink/70">
            Garoua Campus
          </span>
          <span className="flex items-center gap-1.5 text-[0.8rem] font-bold text-brand-800 transition-colors duration-300 group-hover:text-accent-500">
            View department
            <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
