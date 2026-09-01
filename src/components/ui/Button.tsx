import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "accent" | "gold" | "brand" | "outline" | "ghost-light";
type Size = "md" | "lg";

const base =
  "group relative inline-flex items-center justify-center gap-2.5 rounded-full font-semibold " +
  "transition-[transform,box-shadow,background-color,color,border-color] duration-300 ease-[var(--ease-out-quint)] " +
  "will-change-transform active:scale-[0.97] whitespace-nowrap";

const variants: Record<Variant, string> = {
  accent:
    "bg-accent-500 text-white shadow-[var(--shadow-glow)] hover:bg-accent-600 hover:-translate-y-0.5",
  gold: "bg-gold-400 text-ink hover:bg-gold-300 hover:-translate-y-0.5 shadow-[0_18px_36px_-18px_rgb(240_169_29/0.75)]",
  brand:
    "bg-brand-800 text-white hover:bg-brand-700 hover:-translate-y-0.5 shadow-[0_18px_36px_-20px_rgb(16_43_148/0.8)]",
  outline:
    "border-2 border-brand-800/20 text-brand-900 hover:border-accent-500 hover:text-accent-500 hover:-translate-y-0.5",
  "ghost-light":
    "border-2 border-white/25 text-white hover:border-white/60 hover:bg-white/10 hover:-translate-y-0.5",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-6 text-sm",
  lg: "h-[3.25rem] px-8 text-[0.95rem]",
};

export function Button({
  href,
  children,
  variant = "accent",
  size = "md",
  className = "",
  ...rest
}: {
  href?: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
} & Omit<ComponentProps<"button">, "ref">) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;

  if (href) {
    const isWeb = href.startsWith("http");
    const external = isWeb || href.startsWith("tel:") || href.startsWith("mailto:");
    if (external) {
      return (
        <a
          href={href}
          className={cls}
          // Off-site links open in a new tab and must not hand the opener
          // window or the referrer to the destination.
          {...(isWeb
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
