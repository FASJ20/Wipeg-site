import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { GlowField } from "@/components/ui/GlowField";

export default function NotFound() {
  return (
    <section className="relative -mt-[5.25rem] overflow-hidden bg-ink pt-[5.25rem] text-white">
      <GlowField variant="hero" />
      <div className="container-page relative grid min-h-[70vh] place-items-center py-24 text-center">
        <div>
          <p className="text-[6rem] font-extrabold leading-none text-gradient-brand sm:text-[9rem]">
            404
          </p>
          <h1 className="mt-4 text-[1.8rem] font-extrabold sm:text-[2.4rem]">
            We couldn&rsquo;t find that page
          </h1>
          <p className="mx-auto mt-5 max-w-md text-[0.95rem] leading-relaxed text-white/60">
            The page may have moved. Try the programmes list, or head back to
            the home page.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <Button href="/" variant="accent" size="lg">
              Back to home
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
            <Button href="/programmes" variant="ghost-light" size="lg">
              Browse programmes
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
