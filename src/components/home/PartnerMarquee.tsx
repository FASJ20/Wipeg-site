import { ShieldCheck } from "lucide-react";

import { partners } from "@/data/site";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Infinite logo strip from the reference template. WIPEG has partner
 * *names* rather than logo files on the fliers, so each one is set as a
 * wordmark chip — swap in real logo images when the school supplies them.
 *
 * Two identical tracks sit side by side and the wrapper slides exactly
 * -50%, so the loop is seamless with no gap-rounding jump.
 */
/** Defined at module scope: a component created during render would be a new
    type on every pass, remounting the whole strip and restarting the loop. */
function Track({ hidden = false }: { hidden?: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center gap-4 pr-4"
      aria-hidden={hidden || undefined}
    >
      {partners.map((p) => (
        <span
          key={p}
          className="group flex shrink-0 items-center gap-3 rounded-full border border-brand-900/8 bg-tint/60 px-6 py-3.5 transition-colors duration-300 hover:border-accent-500/30 hover:bg-accent-50/60"
        >
          <ShieldCheck className="size-4 shrink-0 text-brand-800/50 transition-colors duration-300 group-hover:text-accent-500" />
          <span className="whitespace-nowrap text-[0.88rem] font-semibold text-brand-900/55 transition-colors duration-300 group-hover:text-brand-800">
            {p}
          </span>
        </span>
      ))}
    </div>
  );
}

export function PartnerMarquee() {
  return (
    <section className="border-b border-brand-900/6 bg-white py-14">
      <Reveal className="container-page">
        <p className="text-center text-[0.8rem] font-semibold tracking-wide text-slate-ink/70">
          Working alongside Cameroon&rsquo;s leading institutions
        </p>
      </Reveal>

      <div className="marquee-mask relative mt-9 overflow-hidden">
        <div className="animate-marquee flex w-max hover:[animation-play-state:paused]">
          <Track />
          <Track hidden />
        </div>
      </div>
    </section>
  );
}
