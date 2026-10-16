import { legacyRedirects } from "./lib/legacy-redirects.mjs";
import { ARTICLES_WP_ORIGIN } from "./lib/cms-hosts.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    // Foundation for a future next/image conversion — not switched over
    // yet since it needs visual QA this sandbox can't do (no browser, no
    // local dev server reachable). remotePatterns alone is harmless on
    // its own; it just allow-lists these hosts for whenever that happens.
    remotePatterns: [
      { protocol: "https", hostname: "www.secretcarshalton.com" },
      { protocol: "https", hostname: "secretcarshalton.com" },
      { protocol: "https", hostname: "www.staging19.secretcarshalton.com" },
      { protocol: "https", hostname: "staging19.secretcarshalton.com" },
      { protocol: "https", hostname: "cms.secretcarshalton.com" },
      { protocol: "https", hostname: "www.cms.secretcarshalton.com" },
    ],
  },
  // Old WordPress addresses that changed — see lib/legacy-redirects.mjs.
  async redirects() {
    return legacyRedirects;
  },
  // Articles, pages and the Instagram feed store their images and videos
  // as https://www.secretcarshalton.com/wp-content/... — once www is this
  // app, those paths are passed through to WordPress so they keep working.
  // Fallback only, so it never shadows a real page. The plugin uploads
  // (event/listing photos) come back with full CMS_ORIGIN URLs already.
  async rewrites() {
    return {
      fallback: [
        { source: "/wp-content/:path*", destination: `${ARTICLES_WP_ORIGIN}/wp-content/:path*` },
      ],
    };
  },
  // Keep every address other than the real domain (the *.vercel.app
  // preview site, branch previews) out of search results, so Google only
  // ever indexes secretcarshalton.com. Robots.txt alone can't do this:
  // it blocks crawling but a blocked page can still be listed.
  async headers() {
    return [
      {
        source: "/:path*",
        missing: [{ type: "host", value: "(www\\.)?secretcarshalton\\.com" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ];
  },
};

export default nextConfig;
