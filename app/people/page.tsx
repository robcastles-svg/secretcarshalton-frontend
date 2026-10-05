import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { ContentList } from "@/app/_components/ContentList";
import { MobileTopAd } from "@/app/_components/MobileTopAd";
import { Pagination } from "@/app/_components/Pagination";
import { SidebarAds } from "@/app/_components/SidebarAds";
import { paginate, parsePageParam } from "@/lib/pagination";
import { getAd, getCategories, getCategoryBySlug, getPostsByCategory, getTags } from "@/lib/wordpress";

export const revalidate = 3600;

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: rawPage } = await searchParams;
  const [category, allCategories, allTags, sidebarAd1, sidebarAd2, sidebarAd3] = await Promise.all([
    getCategoryBySlug("people").catch(() => null),
    getCategories().catch(() => []),
    getTags().catch(() => []),
    getAd("sidebar", 1),
    getAd("sidebar", 2),
    getAd("sidebar", 3),
  ]);
  const posts = category ? await getPostsByCategory(category.id).catch(() => []) : [];
  const categoriesById = new Map(allCategories.map((c) => [c.id, c]));
  const tagsById = new Map(allTags.map((t) => [t.id, t]));
  // 10 per page, not the shared PAGE_SIZE (9) — this grid is 2 columns on
  // desktop, and 9 always leaves one card as a widow on its own row; no
  // featured-listing insert on this page to offset it, unlike
  // Stories/Walks/Themes, so the post count itself needs to be the even
  // number. Rob's call (2026-10): keep the familiar 2-column card size —
  // make 10 the rule instead of narrowing to 3 columns to fit 9.
  const { items: pagePosts, page, totalPages } = paginate(posts, parsePageParam(rawPage), 10);

  return (
    <main className="container">
      <h1>
        Business Spotlight
        <CategoryKeyIcon />
      </h1>
      <MobileTopAd ad={sidebarAd1} />
      <div className="post-layout">
        <div className="post-body">
          <ContentList items={pagePosts} categoriesById={categoriesById} tagsById={tagsById} className="post-list-two-column" />
          <Pagination page={page} totalPages={totalPages} buildHref={(p) => `/people?page=${p}`} />
        </div>
        <aside className="post-sidebar">
          <SidebarAds ads={[sidebarAd1, sidebarAd2, sidebarAd3]} hideFirstOnMobile />
        </aside>
      </div>
    </main>
  );
}
