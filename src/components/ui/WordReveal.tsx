"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ElementType } from "react";

/**
 * Headline animation from the reference video: each word rises out from
 * behind a clipping mask, one after the other. `key` on the wrapper lets
 * the hero slider replay it on every slide change.
 */
export function WordReveal({
  text,
  as = "h1",
  className,
  delay = 0,
  stagger = 0.07,
  highlight,
  highlightClassName = "text-gradient-brand",
}: {
  text: string;
  as?: ElementType;
  className?: string;
  delay?: number;
  stagger?: number;
  /** Words (case-insensitive) rendered in the accent gradient. */
  highlight?: string[];
  highlightClassName?: string;
}) {
  const reduce = useReducedMotion();
  const Tag = as;
  const words = text.split(" ");
  const marked = new Set((highlight ?? []).map((w) => w.toLowerCase()));

  if (reduce) {
    return (
      <Tag className={className}>
        {words.map((w, i) => (
          <span
            key={i}
            className={marked.has(w.toLowerCase().replace(/[^a-z]/gi, "")) ? highlightClassName : undefined}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </Tag>
    );
  }

  return (
    <Tag className={className}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="inline-block overflow-hidden align-bottom pb-[0.12em] -mb-[0.12em]"
        >
          <motion.span
            className={`inline-block ${
              marked.has(word.toLowerCase().replace(/[^a-z]/gi, ""))
                ? highlightClassName
                : ""
            }`}
            initial={{ y: "108%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            transition={{
              duration: 0.85,
              delay: delay + i * stagger,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? <span>&nbsp;</span> : null}
        </span>
      ))}
    </Tag>
  );
}
