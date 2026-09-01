import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { ContentList } from "@/app/_components/ContentList";
import { Pagination } from "@/app/_components/Pagination";
import { paginate, parsePageParam } from "@/lib/pagination";
import { getCategories, getCategoryBySlug, getPostsByCategory, getTags } from "@/lib/wordpress";

export const revalidate = 3600;

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: rawPage } = await searchParams;
  const [category, allCategories, allTags] = await Promise.all([
    getCategoryBySlug("people").catch(() => null),
    getCategories().catch(() => []),
    getTags().catch(() => []),
  ]);
  const posts = category ? await getPostsByCategory(category.id).catch(() => []) : [];
  const categoriesById = new Map(allCategories.map((c) => [c.id, c]));
  const tagsById = new Map(allTags.map((t) => [t.id, t]));
  const { items: pagePosts, page, totalPages } = paginate(posts, parsePageParam(rawPage));

  return (
    <main className="container">
      <h1>
        Business Spotlight
        <CategoryKeyIcon />
      </h1>
      <ContentList items={pagePosts} categoriesById={categoriesById} tagsById={tagsById} />
      <Pagination page={page} totalPages={totalPages} buildHref={(p) => `/people?page=${p}`} />
    </main>
  );
}
