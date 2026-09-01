import type { MetadataRoute } from "next";

import { departments } from "@/data/site";

/** Update this once the real domain is live (see REPLACE-ME.md). */
export const SITE_URL = "https://wipeg.cm";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes = [
    { path: "", priority: 1 },
    { path: "/about", priority: 0.8 },
    { path: "/programmes", priority: 0.9 },
    { path: "/admissions", priority: 0.9 },
    { path: "/campus", priority: 0.7 },
    { path: "/contact", priority: 0.7 },
  ].map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority,
  }));

  const departmentRoutes = departments.map((d) => ({
    url: `${SITE_URL}/programmes/${d.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...departmentRoutes];
}
