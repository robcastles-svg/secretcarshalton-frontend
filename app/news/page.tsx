import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { ContentList } from "@/app/_components/ContentList";
import { Pagination } from "@/app/_components/Pagination";
import { SidebarAds } from "@/app/_components/SidebarAds";
import { paginate, parsePageParam } from "@/lib/pagination";
import { getAd, getCategories, getCategoryBySlug, getPostsByCategory, getTags } from "@/lib/wordpress";

export const revalidate = 3600;

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: rawPage } = await searchParams;
  const [category, allCategories, allTags, inFeedAd, sidebarAd] = await Promise.all([
    getCategoryBySlug("news").catch(() => null),
    getCategories().catch(() => []),
    getTags().catch(() => []),
    getAd("in_feed"),
    getAd("sidebar"),
  ]);
  const posts = category ? await getPostsByCategory(category.id).catch(() => []) : [];
  const categoriesById = new Map(allCategories.map((c) => [c.id, c]));
  const tagsById = new Map(allTags.map((t) => [t.id, t]));
  const { items: pagePosts, page, totalPages } = paginate(posts, parsePageParam(rawPage));

  return (
    <main className="container">
      <h1>
        News
        <CategoryKeyIcon />
      </h1>
      <div className="post-layout">
        <div className="post-body">
          <ContentList items={pagePosts} categoriesById={categoriesById} tagsById={tagsById} />
          <Pagination page={page} totalPages={totalPages} buildHref={(p) => `/news?page=${p}`} />
        </div>
        <aside className="post-sidebar">
          <SidebarAds ads={[inFeedAd, sidebarAd]} />
        </aside>
      </div>
    </main>
  );
}
