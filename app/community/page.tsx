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
  getGroupListings,
  getPostsByCategory,
  getTags,
  stripHtml,
} from "@/lib/wordpress";

export const revalidate = 3600;

export const metadata = { title: "Community — Secret Carshalton" };

/**
 * Interim feed source, per Rob: the real "Community" category doesn't have
 * editorial content in it yet (member-submitted posts still land there via
 * /community/submit, untouched by this), so for now this page borrows the
 * Stories > Carshalton Village sub-category's posts instead — the same
 * source /discover?filter=carshalton-village uses — rather than show a
 * near-empty page. Swap STAND_IN_AREA_SLUG back to null (and restore the
 * getCategoryBySlug("community") lookup below it replaced) once Rob's
 * created the real Community category and started populating it.
 */
const STAND_IN_AREA_SLUG = "carshalton-village";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: rawPage } = await searchParams;

  const [storiesParent, allCategories, allTags, sidebarAd1, sidebarAd2, sidebarAd3, featuredListing, groups] = await Promise.all([
    getCategoryBySlug("stories").catch(() => null),
    getCategories().catch(() => []),
    getTags().catch(() => []),
    getAd("sidebar", 1),
    getAd("sidebar", 2),
    getAd("sidebar", 3),
    getFeaturedListingForGrid(),
    getGroupListings().catch(() => []),
  ]);

  const standInArea = storiesParent
    ? allCategories.find((c) => c.parent === storiesParent.id && c.slug === STAND_IN_AREA_SLUG)
    : null;

  const posts = standInArea ? await getPostsByCategory(standInArea.id).catch(() => []) : [];
  const categoriesById = new Map(allCategories.map((c) => [c.id, c]));
  const tagsById = new Map(allTags.map((t) => [t.id, t]));
  const { items: pagePosts, page, totalPages } = paginate(posts, parsePageParam(rawPage));

  return (
    <main className="container">
      <div className="page-header-row">
        <div>
          <h1>
            Community
            <CategoryKeyIcon />
          </h1>
          <p>Local groups, causes and community-led news from around Carshalton.</p>
        </div>
        <Link href="/community/submit" className="button-pill">
          Share community news
        </Link>
      </div>

      <MobileTopAd ad={sidebarAd1} />

      <div className="post-layout">
        <div className="post-body">
          {pagePosts.length === 0 ? (
            <p className="directory-empty">Nothing shared yet — be the first to post some community news.</p>
          ) : (
            <ContentList
              items={pagePosts}
              categoriesById={categoriesById}
              tagsById={tagsById}
              featuredListing={featuredListing}
            />
          )}
          <Pagination page={page} totalPages={totalPages} buildHref={(p) => `/community?page=${p}`} />
        </div>

        <aside className="post-sidebar">
          {groups.length > 0 && (
            <div className="sidebar-block">
              <h3>Groups to join</h3>
              <ul className="sidebar-theme-list">
                {groups.slice(0, 5).map((listing) => (
                  <li key={listing.id}>
                    <Link href={`/directory/${listing.slug}`}>{stripHtml(listing.title.rendered)}</Link>
                  </li>
                ))}
              </ul>
              <Link href="/community/groups" className="dashboard-my-list-edit">
                See all groups →
              </Link>
            </div>
          )}

          <SidebarAds ads={[sidebarAd1, sidebarAd2, sidebarAd3]} />
        </aside>
      </div>
    </main>
  );
}
