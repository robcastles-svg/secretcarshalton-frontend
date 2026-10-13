import Link from "next/link";
import { SetActiveNavSection } from "@/app/_components/ActiveNavSection";
import { KeyTitle } from "@/app/_components/CategoryKeyIcon";
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
  type WPCategory,
  soft,
} from "@/lib/wordpress";

/**
 * Walks, shared by /walks and the distance pages: a merged feed across
 * every distance, with a filter row across the top. A distance is its
 * own page, /walks/{distance}, rendered here with that distance picked
 * (Rob's call, 2026-10: one look for both, the distance keeping its own
 * address for search). /walks?filter={distance} redirects there.
 */
export async function WalksView({ distance, rawPage }: { distance?: WPCategory; rawPage?: string }) {
  const [parent, allCategories, allTags, sidebarAd1, sidebarAd2, sidebarAd3, featuredListing] = await Promise.all([
    getCategoryBySlug("walks").catch(soft(null)),
    getCategories().catch(soft([])),
    getTags().catch(soft([])),
    getAd("sidebar", 1),
    getAd("sidebar", 2),
    getAd("sidebar", 3),
    getFeaturedListingForGrid(),
  ]);

  const distances = parent ? allCategories.filter((c) => c.parent === parent.id && c.count > 0) : [];
  const activeDistance = distance ?? null;

  const posts = activeDistance
    ? await getPostsByCategory(activeDistance.id).catch(soft([]))
    : await getPostsByCategories(distances.map((d) => d.id)).catch(soft([]));

  const categoriesById = new Map(allCategories.map((c) => [c.id, c]));
  const tagsById = new Map(allTags.map((t) => [t.id, t]));
  // ContentList adds the featured listing as an extra card on top of
  // whatever's in pagePosts (see its own docblock) — one fewer post keeps
  // the total at 10, an even number of cards for the two-column grid,
  // same reasoning as /stories/[area] and /themes/[slug].
  const pageSize = featuredListing ? 9 : 10;
  const { items: pagePosts, page, totalPages } = paginate(posts, parsePageParam(rawPage), pageSize);

  const buildPageHref = (p: number) => (activeDistance ? `/walks/${activeDistance.slug}?page=${p}` : `/walks?page=${p}`);

  return (
    <>
      {activeDistance && <SetActiveNavSection section="Walks" />}
      <div className="secondary-nav-bar">
        <nav className="container secondary-nav">
          <Link href="/walks" className={!activeDistance ? "active" : undefined}>
            All
          </Link>
          {distances.map((d) => (
            <Link
              key={d.id}
              href={`/walks/${d.slug}`}
              className={activeDistance?.id === d.id ? "active" : undefined}
            >
              {d.name}
            </Link>
          ))}
        </nav>
      </div>

      <main className="container">
        <div className="category-header-row">
          <h1>
            <KeyTitle>{activeDistance ? activeDistance.name : "Walks"}</KeyTitle>
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
