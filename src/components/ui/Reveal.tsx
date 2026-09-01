"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ReactNode } from "react";

/**
 * A fixed map of motion primitives rather than `motion.create(tag)`.
 *
 * `motion.create()` must never run during render — a fresh component type on
 * every pass makes React remount the subtree, which re-fires `whileInView`
 * forever ("Maximum update depth exceeded"). A static map is both loop-proof
 * and fully typed.
 */
const tags = {
  div: motion.div,
  p: motion.p,
  span: motion.span,
  section: motion.section,
  article: motion.article,
  aside: motion.aside,
  ul: motion.ul,
  li: motion.li,
  h2: motion.h2,
  h3: motion.h3,
} as const;

export type MotionTag = keyof typeof tags;

type Direction = "up" | "down" | "left" | "right" | "none";

const offset: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 34 },
  down: { x: 0, y: -34 },
  left: { x: 40, y: 0 },
  right: { x: -40, y: 0 },
  none: { x: 0, y: 0 },
};

export function Reveal({
  children,
  as = "div",
  direction = "up",
  delay = 0,
  duration = 0.7,
  className,
  once = true,
  amount = 0.2,
}: {
  children: ReactNode;
  as?: MotionTag;
  direction?: Direction;
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean;
  amount?: number;
}) {
  const reduce = useReducedMotion();
  const MotionTag = tags[as];
  const { x, y } = reduce ? offset.none : offset[direction];

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, x, y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount }}
      transition={{
        duration: reduce ? 0.01 : duration,
        delay: reduce ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </MotionTag>
  );
}

/** Parent that staggers its `RevealItem` children as the group scrolls in. */
export function RevealGroup({
  children,
  className,
  stagger = 0.09,
  delay = 0,
  as = "div",
  amount = 0.15,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  as?: MotionTag;
  amount?: number;
}) {
  const reduce = useReducedMotion();
  const MotionTag = tags[as];

  const variants: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduce ? 0 : stagger,
        delayChildren: reduce ? 0 : delay,
      },
    },
  };

  return (
    <MotionTag
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
    >
      {children}
    </MotionTag>
  );
}

export const revealItemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

export function RevealItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: MotionTag;
}) {
  const MotionTag = tags[as];
  return (
    <MotionTag className={className} variants={revealItemVariants}>
      {children}
    </MotionTag>
  );
}
