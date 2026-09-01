import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { CategoryMiniNav } from "@/app/_components/CategoryMiniNav";
import { ContentList } from "@/app/_components/ContentList";
import { Pagination } from "@/app/_components/Pagination";
import { paginate, parsePageParam } from "@/lib/pagination";
import { getAd, getCategories, getCategoryBySlug, getPostsByCategory, getTags } from "@/lib/wordpress";

export const revalidate = 3600;

export async function generateStaticParams() {
  const parent = await getCategoryBySlug("stories").catch(() => null);
  if (!parent) return [];
  const categories = await getCategories().catch(() => []);
  return categories.filter((c) => c.parent === parent.id && c.count > 0).map((c) => ({ area: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ area: string }>;
}): Promise<Metadata> {
  const { area } = await params;
  const category = await getCategoryBySlug(area).catch(() => null);
  if (!category) return {};
  return { title: `${category.name} — Stories` };
}

export default async function StoriesAreaPage({
  params,
  searchParams,
}: {
  params: Promise<{ area: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { area } = await params;
  const { page: rawPage } = await searchParams;
  const category = await getCategoryBySlug(area).catch(() => null);

  if (!category) notFound();

  const [posts, allCategories, allTags, ad] = await Promise.all([
    getPostsByCategory(category.id).catch(() => []),
    getCategories().catch(() => []),
    getTags().catch(() => []),
    getAd("in_feed"),
  ]);

  const parent = allCategories.find((c) => c.slug === "stories");
  const siblings = parent ? allCategories.filter((c) => c.parent === parent.id && c.count > 0) : [];
  const categoriesById = new Map(allCategories.map((c) => [c.id, c]));
  const tagsById = new Map(allTags.map((t) => [t.id, t]));
  const { items: pagePosts, page, totalPages } = paginate(posts, parsePageParam(rawPage));

  return (
    <>
      <CategoryMiniNav basePath="/stories" categories={siblings} />
      <main className="container">
        <h1>
          {category.name}
          <CategoryKeyIcon />
        </h1>
        <ContentList items={pagePosts} categoriesById={categoriesById} tagsById={tagsById} ad={ad} />
        <Pagination page={page} totalPages={totalPages} buildHref={(p) => `/stories/${area}?page=${p}`} />
      </main>
    </>
  );
}
