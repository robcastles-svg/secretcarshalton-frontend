import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { ContentList } from "@/app/_components/ContentList";
import { MobileTopAd } from "@/app/_components/MobileTopAd";
import { Pagination } from "@/app/_components/Pagination";
import { PromotedGroupSlot } from "@/app/_components/PromotedGroupCard";
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

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: rawPage } = await searchParams;

  const [communityCategory, allCategories, allTags, sidebarAd1, sidebarAd2, sidebarAd3, featuredListing, groups] = await Promise.all([
    getCategoryBySlug("community").catch(() => null),
    getCategories().catch(() => []),
    getTags().catch(() => []),
    getAd("sidebar", 1),
    getAd("sidebar", 2),
    getAd("sidebar", 3),
    getFeaturedListingForGrid(),
    getGroupListings().catch(() => []),
  ]);

  const posts = communityCategory ? await getPostsByCategory(communityCategory.id).catch(() => []) : [];
  const categoriesById = new Map(allCategories.map((c) => [c.id, c]));
  const tagsById = new Map(allTags.map((t) => [t.id, t]));
  // ContentList adds the featured listing as an extra card on top of
  // whatever's in pagePosts (see its own docblock) — one fewer post keeps
  // the total at 10, an even number of cards for the two-column grid,
  // same reasoning as /stories/[area] and /themes/[slug].
  const pageSize = featuredListing ? 9 : 10;
  const { items: pagePosts, page, totalPages } = paginate(posts, parsePageParam(rawPage), pageSize);

  // The top ad slot (both the mobile banner and the first sidebar card)
  // promotes a featured group instead of a blue ad on this page specifically
  // — same card style, pink instead of blue, "Featured" instead of
  // "Advertisement". Falls back to the normal blue ad in that slot when no
  // group is currently featured, rather than leaving it empty.
  const featuredGroup = groups.find((l) => l.meta.sc_featured) ?? null;

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

      {featuredGroup ? (
        <div className="mobile-top-ad">
          <PromotedGroupSlot listing={featuredGroup} />
        </div>
      ) : (
        <MobileTopAd ad={sidebarAd1} />
      )}

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
              className="post-list-two-column"
            />
          )}
          <Pagination page={page} totalPages={totalPages} buildHref={(p) => `/community?page=${p}`} />
        </div>

        <aside className="post-sidebar">
          {featuredGroup && <PromotedGroupSlot listing={featuredGroup} hideOnMobile />}

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

          <SidebarAds
            ads={featuredGroup ? [sidebarAd2, sidebarAd3] : [sidebarAd1, sidebarAd2, sidebarAd3]}
            hideFirstOnMobile={!featuredGroup}
          />
        </aside>
      </div>
    </main>
  );
}
