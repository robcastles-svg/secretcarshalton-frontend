import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { AdSlot } from "@/app/_components/AdSlot";
import { DirectoryListingCard } from "@/app/_components/DirectoryListingCard";
import { PostListCard } from "@/app/_components/PostListCard";
import {
  getCategories,
  getCategoryBySlug,
  getDirectoryCategories,
  getDirectoryListings,
  getPostsByCategories,
  getPostsByCategory,
  type WPContentItem,
  type WPListing,
} from "@/lib/wordpress";

export const revalidate = 3600;

export const metadata = { title: "Discover — Secret Carshalton" };

/** Every 5th card in the default/unfiltered feed is swapped for a featured Directory listing (pink outline) instead of a story — matches the PDF's mixed feed. */
const FEATURE_EVERY = 5;

type FeedItem = { kind: "post"; post: WPContentItem } | { kind: "listing"; listing: WPListing };

function buildFeed(posts: WPContentItem[], featuredListings: WPListing[]): FeedItem[] {
  if (featuredListings.length === 0) {
    return posts.map((post) => ({ kind: "post", post }));
  }
  const feed: FeedItem[] = [];
  let listingIndex = 0;
  posts.forEach((post, i) => {
    feed.push({ kind: "post", post });
    if ((i + 1) % FEATURE_EVERY === 0) {
      feed.push({ kind: "listing", listing: featuredListings[listingIndex % featuredListings.length] });
      listingIndex++;
    }
  });
  return feed;
}

/**
 * The main nav's browsing hub, replacing the old plain /stories link-list.
 * Per Rob (after seeing his own PDF wireframe again): the main feed is all
 * story posts from every area merged together — not links out to the
 * separate area pages — with a featured Directory listing (pink outline)
 * mixed in every few cards. The individual /stories/[area] pages
 * themselves are untouched (still real, separate, crawlable pages — good
 * for SEO), Discover's area/Spotlight/Business-feature row is just a
 * filter on this page's own feed, not a set of links elsewhere.
 * Spotlight is a filter option here now, not its own standing section.
 */
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;

  const [storiesParent, peopleCategory, allCategories, directoryCategories, allListings] = await Promise.all([
    getCategoryBySlug("stories").catch(() => null),
    getCategoryBySlug("people").catch(() => null),
    getCategories().catch(() => []),
    getDirectoryCategories().catch(() => []),
    getDirectoryListings().catch(() => []),
  ]);

  const areas = storiesParent
    ? allCategories.filter((c) => c.parent === storiesParent.id && c.count > 0)
    : [];
  const activeArea = filter ? areas.find((a) => a.slug === filter) : null;
  const isSpotlight = filter === "spotlight";
  const isFeatured = filter === "featured";

  const featuredListings = allListings.filter((l) => l.meta.sc_featured);

  let posts: WPContentItem[] = [];
  if (!isFeatured) {
    if (activeArea) {
      posts = await getPostsByCategory(activeArea.id).catch(() => []);
    } else if (isSpotlight) {
      posts = peopleCategory ? await getPostsByCategory(peopleCategory.id).catch(() => []) : [];
    } else {
      posts = await getPostsByCategories(areas.map((a) => a.id)).catch(() => []);
    }
  }

  // Interleaving only makes sense in the default merged view — a filtered
  // view (one area, Spotlight, or the featured listings themselves) stays
  // as just that one kind of card, not padded out with unrelated ones.
  const feed: FeedItem[] = !filter
    ? buildFeed(posts, featuredListings)
    : isFeatured
      ? featuredListings.map((listing) => ({ kind: "listing", listing }))
      : posts.map((post) => ({ kind: "post", post }));

  return (
    <>
      <div className="secondary-nav-bar">
        <nav className="container secondary-nav">
          <Link href="/discover" className={!filter ? "active" : undefined}>
            All
          </Link>
          {areas.map((area) => (
            <Link
              key={area.id}
              href={`/discover?filter=${area.slug}`}
              className={activeArea?.id === area.id ? "active" : undefined}
            >
              {area.name}
            </Link>
          ))}
          <Link href="/discover?filter=spotlight" className={isSpotlight ? "active" : undefined}>
            Spotlight
          </Link>
          <Link href="/discover?filter=featured" className={isFeatured ? "active" : undefined}>
            Business feature
          </Link>
        </nav>
      </div>

      <main className="container">
        <h1>
          Discover
          <CategoryKeyIcon />
        </h1>
        <p>Stories, walks and local businesses from around Carshalton, all in one feed.</p>

        <div className="post-layout discover-layout">
          <div className="post-body">
            {feed.length === 0 ? (
              <p className="directory-empty">Nothing here yet — check back soon.</p>
            ) : (
              <ul className="post-list">
                {feed.map((item) =>
                  item.kind === "post" ? (
                    <PostListCard key={`post-${item.post.id}`} item={item.post} />
                  ) : (
                    <DirectoryListingCard key={`listing-${item.listing.id}`} listing={item.listing} />
                  )
                )}
              </ul>
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
    </>
  );
}
