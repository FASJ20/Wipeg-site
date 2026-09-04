import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";

import { PageHero } from "@/components/site/PageHero";
import { EnquiryForm } from "@/components/site/EnquiryForm";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { school } from "@/data/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact WIPEG — phone numbers, email, the Garoua main campus address and our branches across Cameroon.",
};

export default function ContactPage() {
  const cards = [
    {
      icon: Phone,
      label: "Phone",
      lines: school.phones,
      hrefs: school.phones.map((p) => `tel:${p.replace(/\s/g, "")}`),
    },
    {
      icon: Mail,
      label: "Email",
      lines: [school.email],
      hrefs: [`mailto:${school.email}`],
    },
    {
      icon: MapPin,
      label: "Campus",
      lines: [school.campus.line, `${school.campus.city}, North Region, Cameroon`],
      hrefs: [],
    },
    {
      icon: Clock,
      label: "Office hours",
      lines: school.hours.split(" · "),
      hrefs: [],
    },
  ];

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to the WIPEG registry"
        intro="Call, email or come to the Garoua main campus. If you send an enquiry we will get back to you with the requirements, the fee schedule and the next intake date."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Contact" }]}
      />

      <section className="bg-white py-24 lg:py-28">
        <div className="container-page">
          <RevealGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(({ icon: Ico, label, lines, hrefs }) => (
              <RevealItem
                key={label}
                className="group rounded-[1.35rem] border border-brand-900/8 bg-white p-6 transition-all duration-500 hover:-translate-y-2 hover:border-brand-800/20 hover:shadow-[var(--shadow-lift)]"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-800 transition-colors duration-500 group-hover:bg-accent-500 group-hover:text-white">
                  <Ico className="size-5" />
                </span>
                <p className="mt-5 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-accent-500">
                  {label}
                </p>
                <div className="mt-2 flex flex-col gap-1">
                  {lines.map((l, i) =>
                    hrefs[i] ? (
                      <a
                        key={l}
                        href={hrefs[i]}
                        className="text-[0.9rem] font-semibold leading-snug text-ink transition-colors hover:text-accent-500"
                      >
                        {l}
                      </a>
                    ) : (
                      <span
                        key={l}
                        className="text-[0.88rem] font-medium leading-snug text-slate-ink"
                      >
                        {l}
                      </span>
                    ),
                  )}
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className="bg-tint py-24 lg:py-32">
        <div className="container-page grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div>
            <Reveal>
              <Eyebrow>Send a message</Eyebrow>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-5 text-[2.1rem] font-extrabold leading-[1.12] text-ink sm:text-[2.6rem]">
                We read every enquiry
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-5 text-[0.95rem] leading-relaxed text-slate-ink">
                Tell us which department interests you and the level you are
                applying for. If it is easier, call the registry directly —
                someone answers during office hours.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="mt-9 flex items-start gap-4 rounded-2xl border border-brand-800/12 bg-white p-5">
                <ShieldCheck className="mt-0.5 size-6 shrink-0 text-brand-800" />
                <p className="text-[0.85rem] leading-relaxed text-slate-ink">
                  <span className="font-bold text-brand-800">
                    AUTH. N° {school.authNumber}
                  </span>
                  <br />
                  Affiliated to the {school.ministry}.
                </p>
              </div>
            </Reveal>
          </div>

          <Reveal direction="left" delay={0.1}>
            <div className="rounded-[1.75rem] border border-brand-900/8 bg-white p-7 sm:p-9">
              <EnquiryForm />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
