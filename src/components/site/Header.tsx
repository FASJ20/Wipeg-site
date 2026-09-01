"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Menu, Phone, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";

import { navigation, school } from "@/data/site";
import { Button } from "@/components/ui/Button";

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile sheet whenever the route changes. Adjusting state during
  // render is React's recommended pattern for "reset state when a prop
  // changes"; doing it in an effect triggers an extra cascading render.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpenMenu(false);
    setOpenGroup(null);
  }

  // Lock body scroll behind the mobile sheet.
  useEffect(() => {
    document.body.style.overflow = openMenu ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [openMenu]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Accreditation strip — the AUTH number is the school's headline
          credential on both fliers, so it stays visible site-wide. */}
      <div className="relative z-50 hidden bg-ink text-white lg:block">
        <div className="container-page flex h-10 items-center justify-between text-[0.7rem]">
          <p className="flex items-center gap-2 tracking-wide text-white/70">
            <ShieldCheck className="size-3.5 text-gold-400" />
            <span className="font-semibold text-white/90">
              AUTH. N° {school.authNumber}
            </span>
            <span className="text-white/30">•</span>
            <span>Affiliated to the {school.ministry}</span>
          </p>
          <p className="flex items-center gap-4 tracking-wide">
            {school.phones.map((p) => (
              <a
                key={p}
                href={`tel:${p.replace(/\s/g, "")}`}
                className="flex items-center gap-1.5 text-white/70 transition-colors hover:text-gold-400"
              >
                <Phone className="size-3" />
                {p}
              </a>
            ))}
          </p>
        </div>
      </div>

      <header
        className={`sticky top-0 z-50 transition-all duration-500 ease-[var(--ease-out-quint)] ${
          scrolled
            ? "bg-white/90 shadow-[0_10px_36px_-24px_rgb(8_18_58/0.5)] backdrop-blur-xl"
            : "bg-transparent"
        }`}
      >
        <div
          className={`container-page flex items-center justify-between transition-all duration-500 ${
            scrolled ? "h-[4.5rem]" : "h-[5.25rem]"
          }`}
        >
          {/* Logo lockup */}
          <Link href="/" className="group flex items-center gap-3">
            <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-white shadow-[0_6px_18px_-8px_rgb(8_18_58/0.55)] ring-1 ring-brand-900/10 transition-transform duration-500 group-hover:scale-105">
              <Image
                src="/brand/wipeg-crest.png"
                alt=""
                width={44}
                height={44}
                className="size-9 object-contain"
                priority
              />
            </span>
            <span className="flex flex-col leading-none">
              <span
                className={`text-[1.35rem] font-extrabold tracking-tight transition-colors duration-300 ${
                  scrolled ? "text-brand-800" : "text-white"
                }`}
              >
                WIPEG
              </span>
              <span
                className={`mt-1 hidden text-[0.56rem] font-semibold uppercase tracking-[0.13em] transition-colors duration-300 sm:block ${
                  scrolled ? "text-accent-500" : "text-gold-400"
                }`}
              >
                Professionalism &amp; Excellent Growth
              </span>
            </span>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-1 xl:flex">
            {navigation.map((item) => {
              const active = isActive(item.href);
              const hasChildren = "children" in item && item.children;

              return (
                <div
                  key={item.href}
                  className="relative"
                  onMouseEnter={() => hasChildren && setOpenGroup(item.href)}
                  onMouseLeave={() => hasChildren && setOpenGroup(null)}
                >
                  <Link
                    href={item.href}
                    className={`flex items-center gap-1 rounded-full px-4 py-2 text-[0.9rem] font-medium transition-colors duration-300 ${
                      scrolled
                        ? active
                          ? "text-accent-500"
                          : "text-ink/80 hover:text-brand-800"
                        : active
                          ? "text-gold-400"
                          : "text-white/85 hover:text-white"
                    }`}
                  >
                    {item.label}
                    {hasChildren && (
                      <ChevronDown
                        className={`size-3.5 transition-transform duration-300 ${
                          openGroup === item.href ? "rotate-180" : ""
                        }`}
                      />
                    )}
                  </Link>

                  {/* Underline that grows from the centre on the active item */}
                  <span
                    className={`pointer-events-none absolute -bottom-0.5 left-1/2 h-0.5 -translate-x-1/2 rounded-full transition-all duration-400 ${
                      active ? "w-5" : "w-0"
                    } ${scrolled ? "bg-accent-500" : "bg-gold-400"}`}
                  />

                  <AnimatePresence>
                    {hasChildren && openGroup === item.href && (
                      <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute left-1/2 top-full w-[26rem] -translate-x-1/2 pt-3"
                      >
                        <div className="overflow-hidden rounded-2xl border border-brand-900/8 bg-white p-2 shadow-[var(--shadow-lift)]">
                          <p className="px-3 pb-2 pt-1.5 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-slate-ink/60">
                            Ten academic departments
                          </p>
                          <div className="grid gap-0.5">
                            {item.children!.map((child) => (
                              <Link
                                key={child.href}
                                href={child.href}
                                className="group/link flex items-center justify-between rounded-xl px-3 py-2 text-[0.85rem] font-medium text-ink/80 transition-colors hover:bg-brand-50 hover:text-brand-800"
                              >
                                {child.label}
                                <span className="translate-x-[-6px] text-accent-500 opacity-0 transition-all duration-300 group-hover/link:translate-x-0 group-hover/link:opacity-100">
                                  →
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <a
              href={`tel:${school.phones[0].replace(/\s/g, "")}`}
              className={`hidden items-center gap-2 rounded-full px-3.5 py-2 text-[0.82rem] font-semibold transition-colors duration-300 lg:flex xl:hidden 2xl:flex ${
                scrolled
                  ? "text-brand-800 hover:text-accent-500"
                  : "text-white/85 hover:text-gold-400"
              }`}
            >
              <span
                className={`grid size-8 place-items-center rounded-full ${
                  scrolled ? "bg-brand-50" : "bg-white/10 ring-1 ring-white/15"
                }`}
              >
                <Phone className="size-3.5" />
              </span>
              {school.phones[0]}
            </a>

            <Button href="/admissions" variant="accent" className="hidden sm:inline-flex">
              Apply Now
            </Button>

            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setOpenMenu(true)}
              className={`grid size-11 place-items-center rounded-full transition-colors duration-300 xl:hidden ${
                scrolled
                  ? "bg-brand-50 text-brand-800"
                  : "bg-white/10 text-white ring-1 ring-white/20"
              }`}
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sheet */}
      <AnimatePresence>
        {openMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] xl:hidden"
          >
            <div
              className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
              onClick={() => setOpenMenu(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-0 flex h-full w-[min(24rem,88vw)] flex-col overflow-y-auto bg-ink text-white"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
                <span className="text-lg font-extrabold">WIPEG</span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpenMenu(false)}
                  className="grid size-10 place-items-center rounded-full bg-white/10 ring-1 ring-white/15"
                >
                  <X className="size-5" />
                </button>
              </div>

              <nav className="flex flex-1 flex-col gap-1 px-4 py-6">
                {navigation.map((item, i) => {
                  const hasChildren = "children" in item && item.children;
                  const expanded = openGroup === item.href;
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.08 + i * 0.05,
                        duration: 0.45,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <div className="flex items-center">
                        <Link
                          href={item.href}
                          className={`flex-1 rounded-xl px-3 py-3 text-[1.05rem] font-semibold transition-colors ${
                            isActive(item.href)
                              ? "text-gold-400"
                              : "text-white/90 hover:text-white"
                          }`}
                        >
                          {item.label}
                        </Link>
                        {hasChildren && (
                          <button
                            type="button"
                            aria-label={`Toggle ${item.label}`}
                            onClick={() =>
                              setOpenGroup(expanded ? null : item.href)
                            }
                            className="grid size-9 place-items-center rounded-full bg-white/8 ring-1 ring-white/12"
                          >
                            <ChevronDown
                              className={`size-4 transition-transform duration-300 ${
                                expanded ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                        )}
                      </div>

                      <AnimatePresence initial={false}>
                        {hasChildren && expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="flex flex-col gap-0.5 border-l border-white/12 pb-2 pl-4 pt-1">
                              {item.children!.map((child) => (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  className="rounded-lg px-3 py-2 text-[0.85rem] text-white/65 transition-colors hover:bg-white/8 hover:text-white"
                                >
                                  {child.label}
                                </Link>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </nav>

              <div className="border-t border-white/10 px-6 py-6">
                <Button href="/admissions" variant="accent" size="lg" className="w-full">
                  Apply Now
                </Button>
                <div className="mt-5 flex flex-col gap-2 text-sm text-white/60">
                  {school.phones.map((p) => (
                    <a
                      key={p}
                      href={`tel:${p.replace(/\s/g, "")}`}
                      className="flex items-center gap-2 transition-colors hover:text-gold-400"
                    >
                      <Phone className="size-3.5" />
                      {p}
                    </a>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
