import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy.
 *
 * The site has no user-generated content, no database, no authentication and
 * no `dangerouslySetInnerHTML`, so the CSP is defence-in-depth rather than a
 * load-bearing control. It is locked down to same-origin everywhere except:
 *
 * - `script-src 'unsafe-inline'` — the Next.js App Router injects inline
 *   bootstrap/flight scripts. Removing this requires a per-request nonce from
 *   middleware, which forces every page to render dynamically and gives up
 *   static hosting. See README ("Tightening the CSP further") for that upgrade.
 * - `style-src 'unsafe-inline'` — required by Tailwind's injected styles and by
 *   Motion, which animates via inline styles.
 * - `'unsafe-eval'` in development only — React Fast Refresh needs it.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Dev needs the HMR websocket; production talks to nothing off-origin.
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Belt-and-braces alongside frame-ancestors, for older browsers.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "autoplay=()",
      "camera=()",
      "display-capture=()",
      "encrypted-media=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=()",
      "usb=()",
      "interest-cohort=()",
    ].join(", "),
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

// HSTS is only meaningful over HTTPS, and pinning it in local dev would make
// http://localhost:6007 unreachable in browsers that cache the directive.
if (!isDev) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Don't advertise the framework version.
  poweredByHeader: false,

  images: {
    formats: ["image/avif", "image/webp"],
    // Every image is local to /public; no remote hosts are allowed to be
    // proxied through the Next.js image optimiser.
    remotePatterns: [],
    dangerouslyAllowSVG: false,
    contentDispositionType: "attachment",
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // No Cache-Control rule here on purpose: Next.js already serves
      // /_next/static with `immutable` caching, and overriding it warns that it
      // "can break Next.js development behavior".
    ];
  },
};

export default nextConfig;
