import { Hero } from "@/components/home/Hero";
import { PartnerMarquee } from "@/components/home/PartnerMarquee";
import { AboutIntro } from "@/components/home/AboutIntro";
import { DepartmentCarousel } from "@/components/home/DepartmentCarousel";
import { FeaturedProgrammes } from "@/components/home/FeaturedProgrammes";
import { WhyChoose } from "@/components/home/WhyChoose";
import { Testimonials } from "@/components/home/Testimonials";
import { FaqSection } from "@/components/home/FaqSection";
import { CtaBand } from "@/components/home/CtaBand";

export default function HomePage() {
  return (
    <>
      <Hero />
      <PartnerMarquee />
      <AboutIntro />
      <DepartmentCarousel />
      <FeaturedProgrammes />
      <WhyChoose />
      <Testimonials />
      <FaqSection />
      <CtaBand />
    </>
  );
}
