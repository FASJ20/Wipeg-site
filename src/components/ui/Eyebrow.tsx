import type { ReactNode } from "react";

/**
 * The dotted uppercase label that sits above every section heading in the
 * reference design.
 */
export function Eyebrow({
  children,
  tone = "light",
  className = "",
}: {
  children: ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  const isDark = tone === "dark";
  return (
    <span
      className={`eyebrow rounded-full px-3.5 py-1.5 ${
        isDark
          ? "bg-white/10 text-white ring-1 ring-white/15 backdrop-blur-sm"
          : "bg-brand-50 text-brand-800 ring-1 ring-brand-800/10"
      } ${className}`}
    >
      <span
        className={`inline-block size-1.5 rounded-full ${
          isDark ? "bg-gold-400" : "bg-accent-500"
        }`}
        aria-hidden
      />
      {children}
    </span>
  );
}
