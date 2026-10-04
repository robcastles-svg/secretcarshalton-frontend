import Link from "next/link";

/**
 * A small, curated cluster of "about the site" pages that all cross-link
 * to each other — not WP-category-driven like CategoryMiniNav (Walks/
 * Stories), since these are just a handful of standalone WP pages Rob
 * wants grouped as one section. Add to this list as he adds more.
 */
const ABOUT_PAGES = [
  { slug: "about-secret-carshalton", label: "About Secret Carshalton" },
  { slug: "welcome-to-carshalton", label: "About Carshalton" },
  { slug: "latest-comments", label: "Latest comments" },
  { slug: "polls", label: "Live poll" },
] as const;

export const ABOUT_PAGE_SLUGS: readonly string[] = ABOUT_PAGES.map((p) => p.slug);

/** Same markup/classes as CategoryMiniNav so it reads as the same bar, just with a fixed set of links instead of a category's children. Hidden on mobile per that component's own rule. */
export function AboutMiniNav({ activeSlug }: { activeSlug: string }) {
  return (
    <nav className="mini-category-nav">
      <div className="container mini-category-nav-inner">
        {ABOUT_PAGES.map((p) => (
          <Link key={p.slug} href={`/${p.slug}`} aria-current={p.slug === activeSlug ? "page" : undefined}>
            {p.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
