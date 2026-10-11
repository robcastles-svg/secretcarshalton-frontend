import Link from "next/link";
import { SetActiveNavSection } from "@/app/_components/ActiveNavSection";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { DirectoryListingCard } from "@/app/_components/DirectoryListingCard";
import { FeaturedListingImpressionTracker } from "@/app/_components/FeaturedListingImpressionTracker";
import { MobileTopAd } from "@/app/_components/MobileTopAd";
import { Pagination } from "@/app/_components/Pagination";
import { PostListCard } from "@/app/_components/PostListCard";
import { SidebarAds } from "@/app/_components/SidebarAds";
import { paginate, parsePageParam } from "@/lib/pagination";
import {
  getAd,
  getCategories,
  getCategoryBySlug,
  getDirectoryCategories,
  getDirectoryListings,
  getPostsByCategories,
  getPostsByCategory,
  getTags,
  GROUPS_CATEGORY_SLUG,
  type WPCategory,
  type WPContentItem,
  type WPListing,
} from "@/lib/wordpress";

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
  // Too few stories to reach the first slot (a quiet area): still show one.
  if (listingIndex === 0 && posts.length > 0) {
    feed.push({ kind: "listing", listing: featuredListings[0] });
  }
  return feed;
}

/**
 * Pagination cuts the feed into fixed 9-card pages, which can land a
 * featured listing right at the top of a page depending on where the
 * FEATURE_EVERY interleave falls relative to the page boundary — swap it
 * with the first post later in the same page so a featured card is never
 * the first thing you see. A no-op on the "Business feature" filter view
 * (every card there is a featured listing by definition) since there's no
 * post on the page to swap with.
 */
function avoidFeaturedFirst(pageItems: FeedItem[]): FeedItem[] {
  if (pageItems.length < 2 || pageItems[0].kind !== "listing") return pageItems;
  const swapIndex = pageItems.findIndex((item) => item.kind === "post");
  if (swapIndex <= 0) return pageItems;
  const next = [...pageItems];
  [next[0], next[swapIndex]] = [next[swapIndex], next[0]];
  return next;
}

/**
 * The main nav's browsing hub, shared by /discover and the area pages.
 * Per Rob (after seeing his own PDF wireframe again): the main feed is all
 * story posts from every area merged together, with a featured Directory
 * listing (pink outline) mixed in every few cards. Spotlight and Business
 * feature are filters on /discover itself (?filter=spotlight|featured);
 * an area is its own page, /stories/{area}, rendered here with that area
 * picked (Rob's call, 2026-10: one look for both, the area keeping its
 * own address for search). /discover?filter={area} redirects there.
 */
export async function DiscoverView({
  filter,
  area,
  rawPage,
}: {
  filter?: string;
  /** The area page's category, when this is /stories/{area}. */
  area?: WPCategory;
  rawPage?: string;
}) {
  const [storiesParent, peopleCategory, allCategories, allTags, directoryCategories, allListings, ad1, ad2, ad3] = await Promise.all([
    getCategoryBySlug("stories").catch(() => null),
    getCategoryBySlug("people").catch(() => null),
    getCategories().catch(() => []),
    getTags().catch(() => []),
    getDirectoryCategories().catch(() => []),
    getDirectoryListings().catch(() => []),
    getAd("sidebar", 1),
    getAd("sidebar", 2),
    getAd("sidebar", 3),
  ]);

  const categoriesById = new Map(allCategories.map((c) => [c.id, c]));
  const tagsById = new Map(allTags.map((t) => [t.id, t]));

  const areas = storiesParent
    ? allCategories.filter((c) => c.parent === storiesParent.id && c.count > 0)
    : [];
  const activeArea = area ?? null;
  const isSpotlight = filter === "spotlight";
  const isFeatured = filter === "featured";

  // Groups get their own separate blue-ad-style promo on /community (see
  // PromotedGroupCard) — excluded here so a featured group never also
  // shows up via the directory's in-feed interleave or its "Business
  // feature" browse tab, the two different things a featured group isn't.
  const groupsCategory = directoryCategories.find((c) => c.slug === GROUPS_CATEGORY_SLUG);
  const featuredListings = allListings.filter(
    (l) => l.meta.sc_featured && (!groupsCategory || !l.sc_listing_category?.includes(groupsCategory.id))
  );


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

  // Every featured listing is mixed in (no monthly view cap any more —
  // Rob, 2026-10) into the merged feed and into an area page
  // (which always carried one before it took on this look). Spotlight and
  // Business feature stay as just that one kind of card.
  const mixed = !filter || Boolean(activeArea);
  const feed: FeedItem[] = mixed
    ? buildFeed(posts, featuredListings)
    : isFeatured
      ? featuredListings.map((listing) => ({ kind: "listing", listing }))
      : posts.map((post) => ({ kind: "post", post }));

  // An area page keeps the 10-a-page it had before (two even columns,
  // no widow card — Rob's call for the 2-column grids).
  const { items: pageFeed, page, totalPages } = paginate(feed, parsePageParam(rawPage), activeArea ? 10 : undefined);
  const pageItems = avoidFeaturedFirst(pageFeed);

  const buildPageHref = (p: number) => {
    if (activeArea) return `/stories/${activeArea.slug}?page=${p}`;
    const params = new URLSearchParams();
    if (filter) params.set("filter", filter);
    params.set("page", String(p));
    return `/discover?${params.toString()}`;
  };

  return (
    <>
      {activeArea && <SetActiveNavSection section="Discover" />}
      <div className="secondary-nav-bar">
        <nav className="container secondary-nav">
          <Link href="/discover" className={!filter && !activeArea ? "active" : undefined}>
            All
          </Link>
          {areas.map((a) => (
            <Link
              key={a.id}
              href={`/stories/${a.slug}`}
              className={activeArea?.id === a.id ? "active" : undefined}
            >
              {a.name}
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
        <div className="category-header-row">
          {activeArea ? (
            <h1>
              {activeArea.name}
              <CategoryKeyIcon />
            </h1>
          ) : (
            <h1>
              Discover
              <CategoryKeyIcon />
            </h1>
          )}
          <p className="category-header-description">
            {activeArea
              ? `Timeless and fascinating stories from around ${activeArea.name}`
              : "Timeless and fascinating stories from around Carshalton and nearby areas"}
          </p>
        </div>

        <MobileTopAd ad={ad1} />

        <div className="post-layout discover-layout">
          <div className="post-body">
            {pageItems.length === 0 ? (
              <p className="directory-empty">Nothing here yet — check back soon.</p>
            ) : (
              <ul className="post-list post-list-two-column">
                {pageItems.map((item) =>
                  item.kind === "post" ? (
                    <PostListCard
                      key={`post-${item.post.id}`}
                      item={item.post}
                      categoriesById={categoriesById}
                      tagsById={tagsById}
                      showDate={false}
                    />
                  ) : (
                    <DirectoryListingCard key={`listing-${item.listing.id}`} listing={item.listing} />
                  )
                )}
              </ul>
            )}
            {mixed &&
              pageItems
                .filter((item) => item.kind === "listing")
                .map((item) => (
                  <FeaturedListingImpressionTracker key={item.listing.id} listingId={item.listing.id} />
                ))}

            <Pagination page={page} totalPages={totalPages} buildHref={buildPageHref} />
          </div>

          <aside className="post-sidebar">
            {directoryCategories.length > 0 && (
              <div className="sidebar-block sidebar-directory-promo">
                <p className="sidebar-directory-eyebrow">Directory</p>
                <h3>Discover local business</h3>
                <p className="sidebar-directory-subtitle">Shops, trades, groups and places around Carshalton.</p>
                <ul className="sidebar-directory-pills">
                  {directoryCategories.slice(0, 11).map((c) => (
                    <li key={c.id}>
                      <Link href={`/directory/${c.slug}`} className="sidebar-directory-pill">
                        {c.name}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link href="/directory" className="sidebar-directory-pill sidebar-directory-pill-browse">
                      Browse all →
                    </Link>
                  </li>
                </ul>
              </div>
            )}

            <SidebarAds ads={[ad1, ad2, ad3]} hideFirstOnMobile />
          </aside>
        </div>
      </main>
    </>
  );
}
