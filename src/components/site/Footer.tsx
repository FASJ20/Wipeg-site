import Image from "next/image";
import Link from "next/link";
import { Facebook, Instagram, Linkedin, Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import { departments, school } from "@/data/site";
import { GlowField } from "@/components/ui/GlowField";
import { Reveal } from "@/components/ui/Reveal";

const socialIcons = {
  Facebook,
  WhatsApp: MessageCircle,
  Instagram,
  LinkedIn: Linkedin,
} as const;

const contactCards = [
  {
    icon: Phone,
    label: "Call the campus",
    lines: school.phones,
    href: `tel:${school.phones[0].replace(/\s/g, "")}`,
  },
  {
    icon: Mail,
    label: "Email us",
    lines: [school.email],
    href: `mailto:${school.email}`,
  },
  {
    icon: MapPin,
    label: "Garoua Main Campus",
    lines: [school.campus.line, `${school.campus.city}, Cameroon`],
    href: "/campus",
  },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-ink text-white">
      <GlowField variant="footer" />

      <div className="container-page relative pb-10 pt-20">
        {/* Contact band */}
        <Reveal className="grid gap-4 border-b border-white/10 pb-12 sm:grid-cols-2 lg:grid-cols-3">
          {contactCards.map(({ icon: Ico, label, lines, href }) => (
            <Link
              key={label}
              href={href}
              className="group flex items-start gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-5 transition-all duration-400 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-500/15 text-accent-300 ring-1 ring-accent-500/25 transition-colors duration-400 group-hover:bg-accent-500 group-hover:text-white">
                <Ico className="size-[1.15rem]" />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.68rem] font-bold uppercase tracking-[0.14em] text-gold-400">
                  {label}
                </span>
                {lines.map((l) => (
                  <span key={l} className="mt-1 block text-sm text-white/75">
                    {l}
                  </span>
                ))}
              </span>
            </Link>
          ))}
        </Reveal>

        {/* Main columns */}
        <div className="grid gap-12 py-14 lg:grid-cols-[1.5fr_1fr_1.2fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-full bg-white p-1.5">
                <Image
                  src="/brand/wipeg-crest.png"
                  alt=""
                  width={48}
                  height={48}
                  className="size-10 object-contain"
                />
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-2xl font-extrabold tracking-tight">WIPEG</span>
                <span className="mt-1 text-[0.58rem] font-semibold uppercase tracking-[0.13em] text-gold-400">
                  {school.motto}
                </span>
              </span>
            </div>

            <p className="mt-6 max-w-md text-sm leading-relaxed text-white/60">
              {school.name} trains students across ten academic departments for
              HND and BTS diplomas, Bachelors and Masters degrees, vocational
              qualifications and IT certifications — from our Garoua main campus.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <Image
                src="/brand/minesup.png"
                alt="Ministry of Higher Education"
                width={44}
                height={44}
                className="size-11 shrink-0 rounded-full bg-white/95 object-contain p-1"
              />
              <p className="text-[0.7rem] leading-snug text-white/50">
                Affiliated to the {school.ministry}
                <br />
                <span className="text-white/70">AUTH. N° {school.authNumber}</span>
                <br />
                Mentored by the {school.mentoredBy} · Affiliated to{" "}
                {school.affiliatedTo}
              </p>
            </div>

            <div className="mt-7 flex gap-2.5">
              {school.socials.map((s) => {
                const Ico = socialIcons[s.label as keyof typeof socialIcons];
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    // Social profiles live off-site: never leak the opener
                    // window or the full referrer to them.
                    {...(s.href.startsWith("http")
                      ? { target: "_blank", rel: "me noopener noreferrer" }
                      : {})}
                    className="grid size-10 place-items-center rounded-full border border-white/12 bg-white/[0.04] text-white/70 transition-all duration-300 hover:-translate-y-1 hover:border-accent-500 hover:bg-accent-500 hover:text-white"
                  >
                    <Ico className="size-4" />
                  </a>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-white">
              Explore
            </h2>
            <ul className="mt-5 flex flex-col gap-2.5 text-sm">
              {[
                ["Home", "/"],
                ["About WIPEG", "/about"],
                ["All programmes", "/programmes"],
                ["Admissions", "/admissions"],
                ["Testimonials", "/testimonials"],
                ["Campus & facilities", "/campus"],
                ["Contact us", "/contact"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="group inline-flex items-center gap-2 text-white/60 transition-colors hover:text-gold-400"
                  >
                    <span className="h-px w-0 bg-gold-400 transition-all duration-300 group-hover:w-3" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-white">
              Departments
            </h2>
            <ul className="mt-5 grid gap-2.5 text-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {departments.map((d) => (
                <li key={d.slug}>
                  <Link
                    href={`/programmes/${d.slug}`}
                    className="text-white/60 transition-colors hover:text-gold-400"
                  >
                    {d.short}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-7 text-[0.78rem] text-white/45 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {school.short} — {school.name}. All
            rights reserved.
          </p>
          <p className="flex items-center gap-5">
            <Link href="/contact" className="transition-colors hover:text-white">
              Privacy Policy
            </Link>
            <Link href="/contact" className="transition-colors hover:text-white">
              Terms &amp; Conditions
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
