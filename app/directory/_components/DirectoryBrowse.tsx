import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { DirectoryListingCard } from "@/app/_components/DirectoryListingCard";
import { Pagination } from "@/app/_components/Pagination";
import { SidebarAds } from "@/app/_components/SidebarAds";
import { DirectoryControls } from "./DirectoryControls";
import { paginate, parsePageParam } from "@/lib/pagination";
import {
  getAd,
  getDirectoryCategories,
  getDirectoryListings,
  getDirectoryListingsByCategory,
  GROUPS_CATEGORY_SLUG,
  stripHtml,
  type WPDirectoryCategory,
  type WPListing,
} from "@/lib/wordpress";

function matchesQuery(listing: WPListing, q: string) {
  if (!q) return true;
  const haystack = `${stripHtml(listing.title.rendered)} ${listing.meta.sc_tagline ?? ""}`.toLowerCase();
  return haystack.includes(q.toLowerCase());
}

/**
 * "Random" is stable for the length of the ISR cache window (revalidate
 * above) rather than truly per-visit — the rendered HTML is what's
 * cached, so every visitor hitting this URL within that hour sees the
 * same shuffled order. Effectively "reshuffled hourly," which is fine
 * for browsing variety without needing per-request rendering.
 */
function sortListings(listings: WPListing[], sort: string) {
  const sorted = [...listings];
  switch (sort) {
    case "oldest":
      return sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    case "title":
      return sorted.sort((a, b) => stripHtml(a.title.rendered).localeCompare(stripHtml(b.title.rendered)));
    case "random":
      return sorted.sort(() => Math.random() - 0.5);
    case "reviews":
      return sorted.sort((a, b) => (b.sc_review_stats?.count ?? 0) - (a.sc_review_stats?.count ?? 0));
    case "rating":
      return sorted.sort((a, b) => (b.sc_review_stats?.average ?? 0) - (a.sc_review_stats?.average ?? 0));
    case "newest":
    default:
      return sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

/**
 * The directory grid, shared by the unfiltered "All" page (/directory) and
 * every category's own dedicated page (/directory/[slug], once the slug
 * doesn't match a real listing — see that file's docblock). Pulled out of
 * what used to be /directory/page.tsx's only job, so a category gets a
 * real crawlable page instead of a ?category= query string — the same
 * reasoning /stories/[area] and /walks/[distance] already use.
 */
export async function DirectoryBrowse({
  activeCategory,
  q,
  sort,
  rawPage,
}: {
  activeCategory: WPDirectoryCategory | null;
  q: string;
  sort: string;
  rawPage?: string;
}) {
  const basePath = activeCategory ? `/directory/${activeCategory.slug}` : "/directory";

  const [allCategories, sidebarAd1, sidebarAd2, sidebarAd3] = await Promise.all([
    getDirectoryCategories().catch(() => []),
    getAd("sidebar", 1),
    getAd("sidebar", 2),
    getAd("sidebar", 3),
  ]);
  // Groups to join moved to its own Community page (app/community/groups) —
  // excluded from browsing here entirely, not just the category nav, so
  // group listings don't still turn up in the unfiltered "All" view.
  const groupsCategory = allCategories.find((c) => c.slug === GROUPS_CATEGORY_SLUG);
  const categories = allCategories.filter((c) => c.slug !== GROUPS_CATEGORY_SLUG);

  const rawListings = await (activeCategory
    ? getDirectoryListingsByCategory(activeCategory.id)
    : getDirectoryListings()
  ).catch(() => []);

  const filteredListings = rawListings
    .filter((l) => matchesQuery(l, q))
    .filter((l) => !groupsCategory || !l.sc_listing_category?.includes(groupsCategory.id));

  // Featured listings sort first, but stay in the same masonry grid as
  // everything else (not a separate row above it) — Rob wants them
  // nearer the rest of the page, not visually cordoned off. Un-paginated
  // (always shown in full, every page of this category) the way the
  // separate row used to be; regular listings paginate as normal after them.
  const featuredListings = sortListings(filteredListings.filter((l) => l.meta.sc_featured), sort);
  const regularListings = sortListings(filteredListings.filter((l) => !l.meta.sc_featured), sort);

  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const { items: pageListings, page, totalPages } = paginate(regularListings, parsePageParam(rawPage));
  const gridListings = [...featuredListings, ...pageListings];

  const buildPageHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort !== "newest") params.set("sort", sort);
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <>
      <div className="secondary-nav-bar">
        <nav className="container secondary-nav">
          <Link href="/directory" className={!activeCategory ? "active" : undefined}>
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/directory/${c.slug}`}
              className={activeCategory?.id === c.id ? "active" : undefined}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      </div>

      <div className="section-hero">
        <div className="container page-header-row">
          <div>
            {activeCategory ? (
              <>
                <span className="section-hero-eyebrow">The Sutton Business Directory</span>
                <h1>
                  {activeCategory.name}
                  <CategoryKeyIcon />
                </h1>
              </>
            ) : (
              <h1>
                The Sutton Business Directory
                <CategoryKeyIcon />
              </h1>
            )}
            <p>Local businesses and organisations in and around Carshalton.</p>
          </div>
          <Link href="/directory/submit" className="button-pill">
            Add a listing
          </Link>
        </div>
      </div>

      <main className="container">
      <div className="directory-toolbar">
        <DirectoryControls basePath={basePath} q={q} sort={sort} />
      </div>

      <div className="post-layout">
        <div className="post-body">
          {featuredListings.length === 0 && regularListings.length === 0 ? (
            <p className="directory-empty">
              {q
                ? `No listings match "${q}" — try a different search or clear it to see everything.`
                : "No listings here yet — the directory is being rebuilt; real listings are on the way."}
            </p>
          ) : (
            <>
              {gridListings.length > 0 && (
                <ul className="post-list directory-list">
                  {gridListings.map((listing) => (
                    <DirectoryListingCard
                      key={listing.id}
                      listing={listing}
                      categoriesList={
                        listing.sc_listing_category
                          ?.map((id) => categoriesById.get(id))
                          .filter((c): c is (typeof categories)[number] => Boolean(c))
                      }
                    />
                  ))}
                </ul>
              )}

              <Pagination page={page} totalPages={totalPages} buildHref={buildPageHref} />
            </>
          )}
        </div>

        <aside className="post-sidebar">
          <SidebarAds ads={[sidebarAd1, sidebarAd2, sidebarAd3]} />
        </aside>
      </div>
      </main>
    </>
  );
}
