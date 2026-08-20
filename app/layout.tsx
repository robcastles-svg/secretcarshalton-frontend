import type { Metadata } from "next";
import { Roboto, Roboto_Slab } from "next/font/google";
import Link from "next/link";
import { getCategories, getCategoryBySlug } from "@/lib/wordpress";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
});

const robotoSlab = Roboto_Slab({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "Secret Carshalton",
  description: "People, Places and Stories in and around Carshalton.",
};

const PRIMARY_NAV = [
  { label: "News", href: "/news" },
  { label: "Events", href: "/events" },
  { label: "Stories", href: "/stories" },
  { label: "Walks", href: "/walks" },
  { label: "Directory", href: "/directory" },
  { label: "Spotlight", href: "/people" },
  { label: "About", href: "/about-secret-carshalton" },
];

const UTILITY_NAV = [
  { label: "Support us", href: "/donate" },
  { label: "Subscribe", href: "/newsletter" },
  { label: "Advertise", href: "/advertising-contact" },
  { label: "Join", href: "/register" },
  { label: "Login", href: "https://www.secretcarshalton.com/login/" },
];

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [stories, walks, allCategories] = await Promise.all([
    getCategoryBySlug("stories"),
    getCategoryBySlug("walks"),
    getCategories(),
  ]);
  const storyAreas = stories ? allCategories.filter((c) => c.parent === stories.id) : [];
  const walkDistances = walks ? allCategories.filter((c) => c.parent === walks.id) : [];

  return (
    <html lang="en">
      <body className={`${roboto.variable} ${robotoSlab.variable}`}>
        <div className="utility-bar">
          <div className="container utility-bar-inner">
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
          </div>
        </div>
        <header className="site-header">
          <Link href="/" className="site-logo">
            Secret Carshalton
          </Link>
          <input type="checkbox" id="nav-toggle" className="nav-toggle" />
          <label htmlFor="nav-toggle" className="nav-toggle-label" aria-label="Menu">
            <span />
          </label>
          <nav className="primary-nav">
            {PRIMARY_NAV.map((item) => (
              <Link key={item.label} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        {children}

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
                  <a href="https://www.secretcarshalton.com/directory/">View all listings</a>
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
          </div>
        </footer>
      </body>
    </html>
  );
}
