import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Link from "next/link";
import { getCategories, getCategoryBySlug } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";
import { ActiveNavSectionProvider } from "./_components/ActiveNavSection";
import { AdSlot } from "./_components/AdSlot";
import { BackToTop } from "./_components/BackToTop";
import { PrimaryNav } from "./_components/PrimaryNav";
import { SiteDateWeather } from "./_components/SiteDateWeather";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-body",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.secretcarshalton.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Secret Carshalton",
  description: "People, Places and Stories in and around Carshalton.",
};

const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Secret Carshalton",
  url: SITE_URL,
  sameAs: [
    "https://www.instagram.com/secret.carshalton",
    "https://www.facebook.com/secret.carshalton",
    "https://x.com/carshaltonviews",
    "https://www.youtube.com/@secretcarshalton",
    "https://www.linkedin.com/company/secret-carshalton/",
    "https://www.tiktok.com/@secretcarshalton",
  ],
};

/**
 * Spotlight and About have come off the main nav — Spotlight's posts now
 * surface on the new Discover hub instead of their own top-level section
 * (see app/discover/page.tsx), and About's content already has its own
 * full footer column, so it didn't need a nav slot too. Discover replaces
 * Stories' nav slot — the individual /stories/[area] and /themes/[slug]
 * pages it links out to are untouched (kept as separate single pages,
 * good for SEO, per Rob), Discover is just a richer hub in front of them.
 */
const PRIMARY_NAV = [
  { label: "News", href: "/news" },
  { label: "Events", href: "/events" },
  { label: "Discover", href: "/discover" },
  { label: "Walks", href: "/walks" },
  { label: "Community", href: "/community" },
  { label: "Directory", href: "/directory" },
  { label: "Jobs", href: "/jobs" },
];

const UTILITY_NAV = [
  { label: "Support", href: "/donate" },
  { label: "Subscribe", href: "/newsletter" },
  { label: "Advertise", href: "/advertising-contact" },
];

/**
 * Visit/Stay/Community used to live here as icon quick-links (pointing at
 * Directory category filters — "places-to-go"/"places-to-stay"/
 * "groups-to-join", genuine sc_listing_category terms, not standalone
 * pages) alongside Jobs. Jobs has since moved into PRIMARY_NAV proper;
 * Visit/Stay are still reachable via Directory's own category nav; Community
 * is getting a dedicated section (with "groups to join" migrating out of
 * Directory into it) rather than staying a quick-link. This bar is now a
 * single membership CTA instead — see MemberBenefitsBar below.
 */

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [stories, walks, allCategories, sessionToken] = await Promise.all([
    getCategoryBySlug("stories"),
    getCategoryBySlug("walks"),
    getCategories(),
    getSessionToken(),
  ]);
  const storyAreas = stories ? allCategories.filter((c) => c.parent === stories.id && c.count > 0) : [];
  const walkDistances = walks ? allCategories.filter((c) => c.parent === walks.id && c.count > 0) : [];

  return (
    <html lang="en">
      <body className={roboto.variable}>
        <ActiveNavSectionProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_SCHEMA) }}
        />
        <div className="member-benefits-bar">
          <Link href={sessionToken ? "/dashboard" : "/register"} className="container member-benefits-inner">
            {sessionToken ? "Member dashboard" : "Member benefits"}
          </Link>
        </div>
        {/* One merged bar — date/weather on the left, utility links on the right — matching the PDF wireframe rather than two stacked bars. */}
        <div className={`utility-bar${sessionToken ? " utility-bar-loggedin" : ""}`}>
          <div className="container utility-bar-inner">
            <SiteDateWeather />
            <div className="utility-bar-links">
              {UTILITY_NAV.map((item) =>
                item.href.startsWith("http") ? (
                  <a key={item.label} href={item.href}>
                    {item.label}
                  </a>
                ) : (
                  <Link key={item.label} href={item.href}>
                    {item.label}
                  </Link>
                )
              )}
              {sessionToken ? (
                <Link href="/dashboard">Member dashboard</Link>
              ) : (
                <>
                  <Link href="/register">Join</Link>
                  <Link href="/login">Login</Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/*
         * Just the one top-of-page ad slot now — billboard, admin-managed
         * via sc-ads. Used to be paired with a second "leaderboard" slot
         * inside the header right below it, which was redundant stacking
         * two banner ads back-to-back now that sidebar and in-post slots
         * exist on content pages too.
         */}
        <AdSlot
          placement="billboard"
          className="ad-slot ad-billboard"
          placeholderClassName="ad-slot-placeholder ad-billboard-placeholder"
          placeholderText="Claim this banner space for your local business"
        />

        <header className="site-header">
          <div className="container site-header-inner">
            <Link href="/" className="site-logo">
              <img src="/logo.png" alt="Secret Carshalton" className="site-logo-img" />
            </Link>
          </div>
          <div className="container primary-nav-row">
            <nav className="primary-nav">
              <PrimaryNav items={PRIMARY_NAV} />
              <Link href="/search" className="nav-search" aria-label="Search">
                <SearchIcon />
              </Link>
            </nav>
          </div>
        </header>

        {children}

        <div className="newsletter-band">
          <div className="container newsletter-band-inner">
            <div>
              <div className="newsletter-band-title">Insider</div>
              <p>The Secret Carshalton newsletter — check your inbox to confirm.</p>
            </div>
            <Link href="/newsletter" className="button-pill">
              Subscribe
            </Link>
          </div>
        </div>

        <footer className="site-footer">
          <div className="container footer-grid">
            <div>
              <h2>Stories</h2>
              <ul>
                {storyAreas.map((area) => (
                  <li key={area.id}>
                    <Link href={`/stories/${area.slug}`}>{area.name}</Link>
                  </li>
                ))}
                <li>
                  <Link href="/themes">Stories by theme</Link>
                </li>
              </ul>
            </div>
            <div>
              <h2>Walks</h2>
              <ul>
                {walkDistances.map((distance) => (
                  <li key={distance.id}>
                    <Link href={`/walks/${distance.slug}`}>{distance.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2>Events</h2>
              <ul>
                <li>
                  <Link href="/events">All Events</Link>
                </li>
                <li>
                  <Link href="/whats-on-in-carshalton">What&apos;s on in Carshalton</Link>
                </li>
                <li>
                  <Link href="/whats-on-in-sutton">What&apos;s on in Sutton</Link>
                </li>
                <li>
                  <Link href="/whats-on-outside-sutton">What&apos;s on outside Sutton</Link>
                </li>
              </ul>
            </div>
            <div>
              <h2>Directory</h2>
              <ul>
                <li>
                  <Link href="/directory">View all listings</Link>
                </li>
                <li>
                  <Link href="/advertising-contact">Add premium listing</Link>
                </li>
                <li>
                  <a href="https://www.secretcarshalton.com/directory-dashboard/">
                    Add free listing
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h2>About</h2>
              <ul>
                <li>
                  <Link href="/help">Help &amp; Support</Link>
                </li>
                <li>
                  <Link href="/disclaimer-terms-conditions">Disclaimer, Terms &amp; Conditions</Link>
                </li>
                <li>
                  <Link href="/contact">Enquiries</Link>
                </li>
                <li>
                  <Link href="/newsletter">Newsletter</Link>
                </li>
                <li>
                  <Link href="/about-secret-carshalton">About us</Link>
                </li>
                <li>
                  <a href="https://www.patreon.com/SecretCarshalton">Patreon</a>
                </li>
              </ul>
            </div>
            <div>
              <Link href="/" className="site-logo footer-logo">
                Secret Carshalton
              </Link>
              <div className="footer-social">
                <a href="https://www.instagram.com/secret.carshalton" aria-label="Instagram">
                  <InstagramIcon />
                </a>
                <a href="https://www.facebook.com/secret.carshalton" aria-label="Facebook">
                  <FacebookIcon />
                </a>
                <a href="https://x.com/carshaltonviews" aria-label="X (Twitter)">
                  <XIcon />
                </a>
                <a href="https://www.youtube.com/@secretcarshalton" aria-label="YouTube">
                  <YouTubeIcon />
                </a>
                <a href="https://www.linkedin.com/company/secret-carshalton/" aria-label="LinkedIn">
                  <LinkedInIcon />
                </a>
                <a href="https://www.tiktok.com/@secretcarshalton" aria-label="TikTok">
                  <TikTokIcon />
                </a>
              </div>
              <p className="footer-copyright">
                Secret Carshalton is proudly 100% Independent. Kindly credit Secret Carshalton if
                you use content from these sections.
                <br />© 2020-2026 Secret Carshalton
              </p>
              <a
                className="google-reviews-badge"
                href="https://www.secretcarshalton.com/reviews/"
              >
                Read our Google reviews
              </a>
              <form action="/search" className="footer-search">
                <input type="search" name="q" placeholder="Search stories and walks" />
                <button type="submit">Search</button>
              </form>
            </div>
          </div>
        </footer>
        <BackToTop />
        </ActiveNavSectionProvider>
      </body>
    </html>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.5c0-.87.24-1.46 1.5-1.46H16V4.35C15.72 4.32 14.76 4.24 13.65 4.24c-2.32 0-3.9 1.42-3.9 4.02V10.5H7.25v3H9.75V21h3.75Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4l7.2 9.2L4.3 20h2.1l5.8-5.8L16.9 20H20l-7.5-9.6L19.6 4h-2.1l-5.4 5.4L8 4H4Z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <rect x="2" y="5.5" width="20" height="13" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 9.5v5l4.5-2.5Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7.5" cy="8" r="1.2" />
      <path d="M6.6 10.5h1.8V17H6.6zM10.5 10.5h1.7v1c.5-.8 1.3-1.2 2.3-1.2 1.9 0 2.9 1.2 2.9 3.3V17h-1.8v-3c0-1.1-.5-1.7-1.4-1.7-.9 0-1.5.6-1.7 1.3-.1.2-.1.4-.1.7V17h-1.8Z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 3c.4 2.2 1.8 3.6 4 3.9v2.9c-1.5 0-2.8-.5-4-1.3v6.1c0 3-2.4 5.4-5.4 5.4S5.2 17.6 5.2 14.6 7.6 9.2 10.6 9.2c.3 0 .6 0 .9.1v3c-.3-.1-.6-.2-.9-.2-1.4 0-2.5 1.1-2.5 2.5s1.1 2.5 2.5 2.5 2.6-1.1 2.6-2.5V3Z" />
    </svg>
  );
}
