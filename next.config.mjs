/** @type {import('next').NextConfig} */
const nextConfig = {
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
    ],
  },
};

export default nextConfig;
