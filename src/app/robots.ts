import type { MetadataRoute } from "next";

import { SITE_URL } from "./sitemap";

/**
 * Search engines are kept out by default, and only let in when
 * NEXT_PUBLIC_ALLOW_INDEXING is explicitly set to "true".
 *
 * Preview and claimable deployments therefore stay unindexed, which matters
 * while the site still carries placeholder content (invented lecturers,
 * entry requirements) alongside WIPEG's real name, accreditation number
 * and phone numbers. Set the variable on the production domain once the
 * REPLACE-ME.md items have been swapped for real information.
 */
export const isIndexable = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";

export default function robots(): MetadataRoute.Robots {
  if (!isIndexable) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
