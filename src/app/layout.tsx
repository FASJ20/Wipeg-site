import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";

import "./globals.css";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ScrollProgress } from "@/components/site/ScrollProgress";
import { school } from "@/data/site";
import { isIndexable } from "./robots";

/* Poppins matches the geometric sans used across the WIPEG fliers. */
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://wipeg.cm"),
  title: {
    default: `${school.short} — ${school.name}`,
    template: `%s | ${school.short}`,
  },
  description:
    "WIPEG, the Wisdom Institute for Professionalism and Excellent Growth, Bamenda — HND/BTS, Bachelors and Masters degrees, vocational training and IT certifications across ten academic departments.",
  keywords: [
    "WIPEG",
    "Wisdom Institute for Professionalism and Excellent Growth",
    "Bamenda higher institute",
    "HND Cameroon",
    "BTS Cameroon",
    "vocational training Bamenda",
    "IT certifications Cameroon",
  ],
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: school.short,
    title: `${school.short} — ${school.motto}`,
    description:
      "Ten academic departments. HND/BTS, Bachelors and Masters degrees, vocational training and IT certifications in Bamenda, Cameroon.",
    images: ["/images/hero-lecture-hall.jpg"],
  },
  icons: {
    icon: "/brand/wipeg-crest.png",
    apple: "/brand/wipeg-crest.png",
  },
  // robots.txt only asks crawlers not to fetch; this header keeps pages
  // discovered via inbound links out of the index too. Flips to indexable
  // when NEXT_PUBLIC_ALLOW_INDEXING=true — see src/app/robots.ts.
  robots: isIndexable
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#08123a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-accent-500 focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <ScrollProgress />
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
