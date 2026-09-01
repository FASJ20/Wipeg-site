"use client";

import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { useState } from "react";

export function Accordion({
  items,
  defaultOpen = 0,
}: {
  items: { q: string; a: string }[];
  defaultOpen?: number | null;
}) {
  const [open, setOpen] = useState<number | null>(defaultOpen);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.q}
            className={`overflow-hidden rounded-2xl border transition-colors duration-300 ${
              isOpen
                ? "border-brand-800/20 bg-brand-50/70"
                : "border-brand-900/8 bg-white hover:border-brand-800/20"
            }`}
          >
            <h3>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span
                  className={`text-[0.95rem] font-semibold transition-colors ${
                    isOpen ? "text-brand-800" : "text-ink"
                  }`}
                >
                  {item.q}
                </span>
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-full transition-all duration-300 ${
                    isOpen
                      ? "rotate-45 bg-accent-500 text-white"
                      : "bg-brand-50 text-brand-800"
                  }`}
                >
                  <Plus className="size-4" strokeWidth={2.5} />
                </span>
              </button>
            </h3>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="px-5 pb-5 pr-14 text-sm leading-relaxed text-slate-ink">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
