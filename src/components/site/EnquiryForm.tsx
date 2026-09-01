"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, Send } from "lucide-react";
import { useState } from "react";

import { departments, school } from "@/data/site";

/**
 * 🔶 FRONT-END ONLY.
 * There is no backend yet, so a submission opens the visitor's mail client
 * addressed to the school. Replace `handleSubmit` with a POST to your own
 * endpoint (Formspree, Web3Forms, or a /api route) when one exists — see
 * REPLACE-ME.md.
 */
export function EnquiryForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  /**
   * Flatten CR/LF and cap length before anything reaches the mailto: URL.
   * Newlines in a mailto subject can be interpreted as additional headers by
   * some mail clients, so single-line fields are sanitised rather than trusted.
   */
  function clean(value: FormDataEntryValue | null, max = 200) {
    return String(value ?? "")
      .replace(/[\r\n]+/g, " ")
      .trim()
      .slice(0, max);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");

    const data = new FormData(e.currentTarget);

    // The programme must be one we actually offer — never echo back a value
    // that was tampered with in the DOM.
    const picked = clean(data.get("programme"), 120);
    const programme = departments.some((d) => d.name === picked)
      ? picked
      : "General enquiry";

    const message = String(data.get("message") ?? "")
      .replace(/\r\n/g, "\n")
      .trim()
      .slice(0, 2000);

    const body = [
      `Name: ${clean(data.get("name"), 120)}`,
      `Phone: ${clean(data.get("phone"), 40)}`,
      `Email: ${clean(data.get("email"), 160)}`,
      `Programme of interest: ${programme}`,
      "",
      message,
    ].join("\n");

    const href = `mailto:${encodeURIComponent(school.email)}?subject=${encodeURIComponent(
      `Application enquiry — ${programme}`,
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = href;
    setTimeout(() => setState("sent"), 600);
  }

  const field =
    "w-full rounded-xl border border-brand-900/12 bg-white px-4 py-3 text-[0.9rem] text-ink outline-none transition-colors duration-300 placeholder:text-slate-ink/45 focus:border-accent-500";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-[0.75rem] font-bold uppercase tracking-wide text-slate-ink/70">
            Full name
          </span>
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
          <span className="text-[0.75rem] font-bold uppercase tracking-wide text-slate-ink/70">
            Phone number
          </span>
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
          <span className="text-[0.75rem] font-bold uppercase tracking-wide text-slate-ink/70">
            Email address
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
          <span className="text-[0.75rem] font-bold uppercase tracking-wide text-slate-ink/70">
            Programme of interest
          </span>
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
        <span className="text-[0.75rem] font-bold uppercase tracking-wide text-slate-ink/70">
          Your message
        </span>
        <textarea
          name="message"
          rows={5}
          required
          maxLength={2000}
          placeholder="Tell us which level you're applying for and any questions you have."
          className={`${field} resize-y`}
        />
      </label>

      <button
        type="submit"
        disabled={state !== "idle"}
        className="group mt-2 inline-flex h-[3.25rem] items-center justify-center gap-2.5 rounded-full bg-accent-500 px-8 text-[0.95rem] font-semibold text-white shadow-[var(--shadow-glow)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-accent-600 disabled:opacity-70"
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
              Send enquiry
              <Send className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </motion.span>
          )}
          {state === "sending" && (
            <motion.span
              key="sending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5"
            >
              Opening your mail app
              <Loader2 className="size-4 animate-spin" />
            </motion.span>
          )}
          {state === "sent" && (
            <motion.span
              key="sent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2.5"
            >
              Enquiry ready to send
              <Check className="size-4" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <p className="text-[0.75rem] leading-relaxed text-slate-ink/60">
        Prefer to call? Reach the registry on{" "}
        <a
          href={`tel:${school.phones[0].replace(/\s/g, "")}`}
          className="font-semibold text-brand-800 hover:text-accent-500"
        >
          {school.phones[0]}
        </a>{" "}
        or{" "}
        <a
          href={`tel:${school.phones[1].replace(/\s/g, "")}`}
          className="font-semibold text-brand-800 hover:text-accent-500"
        >
          {school.phones[1]}
        </a>
        .
      </p>
    </form>
  );
}
