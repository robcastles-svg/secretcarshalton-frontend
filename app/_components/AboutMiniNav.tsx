import Link from "next/link";

/**
 * A small, curated cluster of "about the site" pages that all cross-link
 * to each other — not WP-category-driven like CategoryMiniNav (the
 * Walks/Stories sub-page nav), since these are just a handful of
 * standalone WP pages Rob wants grouped as one section. Add to this
 * list as he adds more.
 *
 * Uses .secondary-nav-bar/.secondary-nav — the Walks/Discover top-level
 * browse-page nav — not .mini-category-nav (CategoryMiniNav), which is
 * desktop-only. Rob's call: this should show on mobile too, same as
 * Walks/Discover's.
 */
const ABOUT_PAGES = [
  { slug: "about-secret-carshalton", label: "About Secret Carshalton" },
  { slug: "welcome-to-carshalton", label: "About Carshalton" },
  { slug: "latest-comments", label: "Latest comments" },
  { slug: "polls", label: "Live poll" },
] as const;

export const ABOUT_PAGE_SLUGS: readonly string[] = ABOUT_PAGES.map((p) => p.slug);

export function AboutMiniNav({ activeSlug }: { activeSlug: string }) {
  return (
    <div className="secondary-nav-bar">
      <nav className="container secondary-nav">
        {ABOUT_PAGES.map((p) => (
          <Link key={p.slug} href={`/${p.slug}`} className={p.slug === activeSlug ? "active" : undefined}>
            {p.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
