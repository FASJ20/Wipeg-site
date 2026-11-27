"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Loader2, MessageCircle } from "lucide-react";
import { useState } from "react";

import { branches, departments, school } from "@/data/site";
import { WHATSAPP_DISPLAY, oneLine, whatsappLink } from "@/lib/whatsapp";

/**
 * The enquiry form hands the visitor a WhatsApp message, already written.
 *
 * It used to build a `mailto:` link. On a phone — which is how nearly every
 * prospective student arrives — that opens a mail app most people have never
 * set up, and the enquiry dies in a draft nobody at WIPEG ever learns about.
 * WhatsApp is where these conversations already happen here.
 *
 * Nothing is sent by this form. It composes the message and opens WhatsApp;
 * the visitor presses send themselves. The wording below is careful about
 * that — the site does not know whether the message went, and must not
 * pretend otherwise.
 */
export function EnquiryForm() {
  const [state, setState] = useState<"idle" | "opening" | "opened">("idle");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("opening");

    const data = new FormData(e.currentTarget);

    // Only echo back values we actually offer. A select can be edited in the
    // DOM, and a tampered value should not end up in a message that looks
    // like it came from the school's own form.
    const pickedProgramme = oneLine(data.get("programme"), 120);
    const programme = departments.some((d) => d.name === pickedProgramme)
      ? pickedProgramme
      : "Not decided yet";

    const pickedCampus = oneLine(data.get("campus"), 60);
    const campus = branches.some((b) => b.city === pickedCampus)
      ? pickedCampus
      : school.campus.city;

    const message = String(data.get("message") ?? "")
      .replace(/\r\n/g, "\n")
      .trim()
      .slice(0, 900);

    const lines = [
      `Hello WIPEG, I would like to enquire about admission.`,
      ``,
      `Name: ${oneLine(data.get("name"), 120)}`,
      `Phone: ${oneLine(data.get("phone"), 40)}`,
      `Campus: ${campus}`,
      `Programme: ${programme}`,
    ];

    const email = oneLine(data.get("email"), 160);
    if (email) lines.push(`Email: ${email}`);

    if (message) lines.push("", message);

    const href = whatsappLink(lines.join("\n"));

    // A new tab, so the visitor still has WIPEG open behind WhatsApp Web on a
    // desktop. `window.open` inside a submit handler counts as a user gesture,
    // so it is not treated as a popup — but if a browser blocks it anyway,
    // fall back to navigating, which always works.
    const opened = window.open(href, "_blank", "noopener,noreferrer");
    if (!opened) window.location.href = href;

    setState("opened");
  }

  const field =
    "w-full rounded-xl border border-brand-900/12 bg-white px-4 py-3 text-[0.9rem] text-ink outline-none transition-colors duration-300 placeholder:text-slate-ink/45 focus:border-accent-500";
  const labelText =
    "text-[0.75rem] font-bold uppercase tracking-wide text-slate-ink/70";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={labelText}>Full name</span>
          <input
            name="name"
            required
            maxLength={120}
            autoComplete="name"
            placeholder="Your full name"
            className={field}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className={labelText}>Phone number</span>
          <input
            name="phone"
            required
            type="tel"
            maxLength={40}
            autoComplete="tel"
            inputMode="tel"
            placeholder="+237 6.. ... ..."
            className={field}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={labelText}>Campus</span>
          <select name="campus" required defaultValue="" className={field}>
            <option value="" disabled>
              Choose a campus
            </option>
            {branches.map((b) => (
              <option key={b.city} value={b.city}>
                {b.city}
                {b.main ? " (main campus)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className={labelText}>Programme of interest</span>
          <select name="programme" required defaultValue="" className={field}>
            <option value="" disabled>
              Choose a department
            </option>
            {departments.map((d) => (
              <option key={d.slug} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className={labelText}>
          Email address <span className="font-medium normal-case">(optional)</span>
        </span>
        <input
          name="email"
          type="email"
          maxLength={160}
          autoComplete="email"
          placeholder="you@example.com"
          className={field}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className={labelText}>Your message</span>
        <textarea
          name="message"
          rows={4}
          required
          maxLength={900}
          placeholder="Tell us which level you're applying for and any questions you have."
          className={`${field} resize-y`}
        />
      </label>

      <button
        type="submit"
        className="group mt-2 inline-flex h-[3.25rem] items-center justify-center gap-2.5 rounded-full bg-accent-500 px-8 text-[0.95rem] font-semibold text-white shadow-[var(--shadow-glow)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-accent-600"
      >
        <AnimatePresence mode="wait" initial={false}>
          {state === "idle" && (
            <motion.span
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5"
            >
              <MessageCircle className="size-4" />
              Send on WhatsApp
              <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </motion.span>
          )}
          {state === "opening" && (
            <motion.span
              key="opening"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5"
            >
              Opening WhatsApp
              <Loader2 className="size-4 animate-spin" />
            </motion.span>
          )}
          {state === "opened" && (
            <motion.span
              key="opened"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2.5"
            >
              <MessageCircle className="size-4" />
              Send it again
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Said plainly, because the button cannot say it: the message is
          written, not sent. Somebody who closes WhatsApp at this point has
          not contacted WIPEG, and should know that. */}
      <AnimatePresence initial={false}>
        {state === "opened" && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="rounded-xl bg-accent-500/8 px-4 py-3 text-[0.8rem] leading-relaxed text-ink/80"
          >
            Your message is waiting in WhatsApp — <strong>press send there</strong> to
            reach us. Nothing has been sent yet.
          </motion.p>
        )}
      </AnimatePresence>

      <p className="text-[0.75rem] leading-relaxed text-slate-ink/60">
        Prefer to call? Reach the registry on{" "}
        <a
          href={`tel:${WHATSAPP_DISPLAY.replace(/\s/g, "")}`}
          className="font-semibold text-brand-800 hover:text-accent-500"
        >
          {WHATSAPP_DISPLAY}
        </a>
        , or email{" "}
        <a
          href={`mailto:${school.email}`}
          className="font-semibold text-brand-800 hover:text-accent-500"
        >
          {school.email}
        </a>
        .
      </p>
    </form>
  );
}
