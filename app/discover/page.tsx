import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { ContentList } from "@/app/_components/ContentList";
import { AdSlot } from "@/app/_components/AdSlot";
import { DirectoryListingCard } from "@/app/_components/DirectoryListingCard";
import {
  getCategories,
  getCategoryBySlug,
  getDirectoryCategories,
  getDirectoryListings,
  getPostsByCategory,
  getTags,
} from "@/lib/wordpress";
import { DiscoverBrowseTiles } from "./_components/DiscoverBrowseTiles";

export const revalidate = 3600;

export const metadata = { title: "Discover — Secret Carshalton" };

/**
 * Replaces the old plain /stories link-list as the main nav's browsing
 * hub. Individual /stories/[area] and /themes/[slug] pages are untouched
 * (kept as separate, single, crawlable pages — good for SEO, per Rob),
 * this just gives them a richer front door: area tiles by default with a
 * toggle to browse by theme instead, Directory's own categories linked
 * alongside for cross-pollination, and the Business Spotlight posts
 * (which came off the main nav) folded in here for now rather than losing
 * their visibility entirely.
 */
export default async function DiscoverPage() {
  const [storiesParent, peopleCategory, allCategories, tags, directoryCategories, allListings] = await Promise.all([
    getCategoryBySlug("stories").catch(() => null),
    getCategoryBySlug("people").catch(() => null),
    getCategories().catch(() => []),
    getTags().catch(() => []),
    getDirectoryCategories().catch(() => []),
    getDirectoryListings().catch(() => []),
  ]);

  const areas = storiesParent
    ? allCategories.filter((c) => c.parent === storiesParent.id && c.count > 0)
    : [];
  const themes = tags.filter((t) => t.count === undefined || t.count > 0);

  const spotlightPosts = peopleCategory
    ? (await getPostsByCategory(peopleCategory.id).catch(() => [])).slice(0, 4)
    : [];

  // Cross-pollination the other direction — a business that's paid to be
  // featured in the Directory also gets a shot at this hub's traffic, not
  // just its own category page. Capped small since this is a browsing
  // aid, not a full directory listing.
  const featuredListings = allListings.filter((l) => l.meta.sc_featured).slice(0, 3);

  return (
    <main className="container discover-page">
      <h1>
        Discover
        <CategoryKeyIcon />
      </h1>
      <p>Browse Carshalton and the surrounding area by place or by theme.</p>

      <div className="post-layout discover-layout">
        <div className="post-body">
          <DiscoverBrowseTiles areas={areas} themes={themes} />

          {featuredListings.length > 0 && (
            <section className="discover-section">
              <div className="home-section-header">
                <h2>Featured local businesses</h2>
                <Link href="/directory">View the directory</Link>
              </div>
              <ul className="post-list directory-featured-list">
                {featuredListings.map((listing) => (
                  <DirectoryListingCard key={listing.id} listing={listing} />
                ))}
              </ul>
            </section>
          )}

          {spotlightPosts.length > 0 && (
            <section className="discover-section">
              <div className="home-section-header">
                <h2>Business Spotlight</h2>
                <Link href="/people">See all</Link>
              </div>
              <ContentList items={spotlightPosts} />
            </section>
          )}
        </div>

        <aside className="post-sidebar">
          {directoryCategories.length > 0 && (
            <div className="sidebar-block">
              <h3>Local businesses by category</h3>
              <ul className="sidebar-theme-list">
                {directoryCategories.slice(0, 12).map((c) => (
                  <li key={c.id}>
                    <Link href={`/directory?category=${c.slug}`}>{c.name.toUpperCase()}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <AdSlot
            placement="sidebar"
            className="sidebar-block-ad"
            placeholderClassName="sidebar-ad-placeholder"
            placeholderText="Advertise here"
          />
        </aside>
      </div>
    </main>
  );
}
