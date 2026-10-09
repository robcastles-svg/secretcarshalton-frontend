import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { ContentList } from "@/app/_components/ContentList";
import { MobileTopAd } from "@/app/_components/MobileTopAd";
import { Pagination } from "@/app/_components/Pagination";
import { SidebarAds } from "@/app/_components/SidebarAds";
import { paginate, parsePageParam } from "@/lib/pagination";
import {
  getAd,
  getCategories,
  getCategoryBySlug,
  getFeaturedListingForGrid,
  getPostsByCategories,
  getPostsByCategory,
  getTags,
} from "@/lib/wordpress";

export const revalidate = 3600;

/**
 * Same shape as Discover: a merged feed across every distance by default,
 * with a filter row across the top to narrow to one — not a set of links
 * out to separate pages. The /walks/[distance] pages themselves stay as
 * they were (still real, separate, crawlable pages — good for SEO); this
 * filter just reuses their slugs as the ?filter= value on this one page.
 */
export default async function WalksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const { filter, page: rawPage } = await searchParams;

  const [parent, allCategories, allTags, sidebarAd1, sidebarAd2, sidebarAd3, featuredListing] = await Promise.all([
    getCategoryBySlug("walks").catch(() => null),
    getCategories().catch(() => []),
    getTags().catch(() => []),
    getAd("sidebar", 1),
    getAd("sidebar", 2),
    getAd("sidebar", 3),
    getFeaturedListingForGrid(),
  ]);

  const distances = parent ? allCategories.filter((c) => c.parent === parent.id && c.count > 0) : [];
  const activeDistance = filter ? distances.find((d) => d.slug === filter) : null;

  const posts = activeDistance
    ? await getPostsByCategory(activeDistance.id).catch(() => [])
    : await getPostsByCategories(distances.map((d) => d.id)).catch(() => []);

  const categoriesById = new Map(allCategories.map((c) => [c.id, c]));
  const tagsById = new Map(allTags.map((t) => [t.id, t]));
  // ContentList adds the featured listing as an extra card on top of
  // whatever's in pagePosts (see its own docblock) — one fewer post keeps
  // the total at 10, an even number of cards for the two-column grid,
  // same reasoning as /stories/[area] and /themes/[slug].
  const pageSize = featuredListing ? 9 : 10;
  const { items: pagePosts, page, totalPages } = paginate(posts, parsePageParam(rawPage), pageSize);

  const buildPageHref = (p: number) => {
    const params = new URLSearchParams();
    if (filter) params.set("filter", filter);
    params.set("page", String(p));
    return `/walks?${params.toString()}`;
  };

  return (
    <>
      <div className="secondary-nav-bar">
        <nav className="container secondary-nav">
          <Link href="/walks" className={!filter ? "active" : undefined}>
            All
          </Link>
          {distances.map((distance) => (
            <Link
              key={distance.id}
              href={`/walks?filter=${distance.slug}`}
              className={activeDistance?.id === distance.id ? "active" : undefined}
            >
              {distance.name}
            </Link>
          ))}
        </nav>
      </div>

      <main className="container">
        <div className="category-header-row">
          <h1>
            {activeDistance ? activeDistance.name : "Walks"}
            <CategoryKeyIcon />
          </h1>
          <p className="category-header-description">
            Great ideas for often FREE places to visit in a day, from Carshalton
          </p>
        </div>

        <MobileTopAd ad={sidebarAd1} />

        <div className="post-layout">
          <div className="post-body">
            {pagePosts.length === 0 ? (
              <p className="directory-empty">Nothing here yet — check back soon.</p>
            ) : (
              <ContentList
                items={pagePosts}
                categoriesById={categoriesById}
                tagsById={tagsById}
                featuredListing={featuredListing}
                className="post-list-two-column"
              />
            )}
            <Pagination page={page} totalPages={totalPages} buildHref={buildPageHref} />
          </div>
          <aside className="post-sidebar">
            <SidebarAds ads={[sidebarAd1, sidebarAd2, sidebarAd3]} hideFirstOnMobile />
          </aside>
        </div>
      </main>
    </>
  );
}
