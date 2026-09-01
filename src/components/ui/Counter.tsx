"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";

/** Counts up from 0 once it scrolls into view. 1200 renders as "1.2k". */
export function Counter({
  value,
  suffix = "",
  duration = 1600,
  className,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);

  useEffect(() => {
    // Reduced motion is handled by deriving the value below rather than
    // setting state here — a synchronous setState in an effect body causes
    // a cascading re-render.
    if (!inView || reduce) return;

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // easeOutExpo — fast start, long settle
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setN(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration, reduce]);

  // With reduced motion the final value is shown immediately, no animation.
  const shown = reduce ? value : n;
  const display =
    value >= 1000 ? `${(shown / 1000).toFixed(shown >= 1000 ? 1 : 0)}k` : `${shown}`;

  return (
    <span ref={ref} className={className}>
      {display}
      {suffix}
    </span>
  );
}
