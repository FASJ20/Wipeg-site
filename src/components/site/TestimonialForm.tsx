"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, Send } from "lucide-react";
import { useState } from "react";

import { departments, school } from "@/data/site";

/**
 * 🔶 FRONT-END ONLY — same mechanism as the enquiry form.
 *
 * A submission opens the visitor's mail client addressed to the school; it
 * does NOT publish to the site. That is deliberate: a testimonial carries a
 * real person's name, so the registry reviews it and adds it to
 * `testimonials` in src/data/site.ts by hand.
 *
 * Replace `handleSubmit` with a POST to a real endpoint when one exists —
 * see REPLACE-ME.md.
 */
export function TestimonialForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [consent, setConsent] = useState(false);

  /** Flatten CR/LF and cap length before anything reaches the mailto: URL,
      so a crafted value cannot inject extra mail headers. */
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

    const picked = clean(data.get("programme"), 120);
    const programme = departments.some((d) => d.name === picked)
      ? picked
      : "Not stated";

    const quote = String(data.get("quote") ?? "")
      .replace(/\r\n/g, "\n")
      .trim()
      .slice(0, 1500);

    const body = [
      `Name: ${clean(data.get("name"), 120)}`,
      `What they do now: ${clean(data.get("role"), 120)}`,
      `Programme studied: ${programme}`,
      `Year finished: ${clean(data.get("year"), 12)}`,
      `Contact: ${clean(data.get("contact"), 160)}`,
      "",
      "Testimonial:",
      quote,
      "",
      "Consent: the sender ticked the box agreeing WIPEG may publish this",
      "testimonial with their name on the website.",
    ].join("\n");

    const href = `mailto:${encodeURIComponent(school.email)}?subject=${encodeURIComponent(
      `Testimonial from ${clean(data.get("name"), 60) || "a graduate"}`,
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = href;
    setTimeout(() => setState("sent"), 600);
  }

  const field =
    "w-full rounded-xl border border-brand-900/12 bg-white px-4 py-3 text-[0.9rem] text-ink outline-none transition-colors duration-300 placeholder:text-slate-ink/45 focus:border-accent-500";
  const label =
    "text-[0.75rem] font-bold uppercase tracking-wide text-slate-ink/70";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={label}>Your name</span>
          <input
            name="name"
            required
            maxLength={120}
            autoComplete="name"
            placeholder="The name you want published"
            className={field}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className={label}>What you do now</span>
          <input
            name="role"
            required
            maxLength={120}
            placeholder="e.g. Software Engineer"
            className={field}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={label}>Programme you studied</span>
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

        <label className="flex flex-col gap-2">
          <span className={label}>Year you finished</span>
          <input
            name="year"
            maxLength={12}
            inputMode="numeric"
            placeholder="e.g. 2025"
            className={field}
          />
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className={label}>Phone or email (so we can reach you)</span>
        <input
          name="contact"
          required
          maxLength={160}
          placeholder="+237 6.. ... ... or you@example.com"
          className={field}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className={label}>Your testimonial</span>
        <textarea
          name="quote"
          rows={6}
          required
          maxLength={1500}
          placeholder="What did WIPEG give you? Write it in your own words — we publish it as you wrote it."
          className={`${field} resize-y`}
        />
      </label>

      {/* Consent is the point of this form: we publish a real name, so we
          need the person to say we may. */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-900/10 bg-white px-4 py-3.5">
        <input
          type="checkbox"
          name="consent"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent-500)]"
        />
        <span className="text-[0.82rem] leading-relaxed text-slate-ink">
          I agree that WIPEG may publish this testimonial, with my name and
          what I do now, on the WIPEG website.
        </span>
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
              Send my testimonial
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
              Ready to send
              <Check className="size-4" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <p className="text-[0.75rem] leading-relaxed text-slate-ink/60">
        Testimonials are read by the registry before they appear on the site —
        nothing is published automatically. Prefer to send it yourself? Email{" "}
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
