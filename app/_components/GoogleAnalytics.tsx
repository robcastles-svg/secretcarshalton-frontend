import Script from "next/script";

/**
 * The same GA4 property the WordPress site reports to, so traffic history
 * carries straight on after the switch. Only counts visits on
 * secretcarshalton.com itself — Vercel previews and local dev never load
 * it, so testing before launch doesn't skew the figures. Page changes
 * within the app are picked up by GA4's own enhanced measurement
 * (browser history events), so no extra router tracking is needed.
 * No consent banner for now (Rob's call, 2026-10).
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-QY2JNYX7SC";

export function GoogleAnalytics() {
  return (
    <Script id="ga-init" strategy="afterInteractive">
      {`(function () {
  if (!/(^|\\.)secretcarshalton\\.com$/.test(location.hostname)) return;
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=${GA_ID}";
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag("js", new Date());
  gtag("config", "${GA_ID}");
})();`}
    </Script>
  );
}
