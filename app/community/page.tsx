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
  getPostsByCategory,
  getTags,
} from "@/lib/wordpress";

export const revalidate = 3600;

export const metadata = { title: "Community — Secret Carshalton" };

/**
 * The real feed, now that member-submitted community news has somewhere
 * to land: a plain "Community" category, same shape as every other
 * category page (News, Walks, Themes) — no bespoke mock-card treatment
 * needed any more. The Groups directory is still a separate, unbuilt
 * piece (Rob wants to see a page design for it first) — the note below
 * stays as the placeholder for that specifically.
 */
export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: rawPage } = await searchParams;

  const [category, allCategories, allTags, inFeedAd, sidebarAd, featuredListing] = await Promise.all([
    getCategoryBySlug("community").catch(() => null),
    getCategories().catch(() => []),
    getTags().catch(() => []),
    getAd("in_feed"),
    getAd("sidebar"),
    getFeaturedListingForGrid(),
  ]);

  const posts = category ? await getPostsByCategory(category.id).catch(() => []) : [];
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

      <MobileTopAd ad={inFeedAd} />

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
          <SidebarAds ads={[inFeedAd, sidebarAd]} />
        </aside>
      </div>

      <p className="community-groups-note">
        A directory of local groups to join is on the way — we&apos;ll link it from here once it&apos;s ready.
      </p>
    </main>
  );
}
