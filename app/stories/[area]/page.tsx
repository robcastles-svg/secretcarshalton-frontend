import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryMiniNav } from "@/app/_components/CategoryMiniNav";
import { ContentList } from "@/app/_components/ContentList";
import { getCategories, getCategoryBySlug, getPostsByCategory, getTags } from "@/lib/wordpress";

export const revalidate = 3600;

export async function generateStaticParams() {
  const parent = await getCategoryBySlug("stories");
  if (!parent) return [];
  const categories = await getCategories();
  return categories.filter((c) => c.parent === parent.id).map((c) => ({ area: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ area: string }>;
}): Promise<Metadata> {
  const { area } = await params;
  const category = await getCategoryBySlug(area);
  if (!category) return {};
  return { title: `${category.name} — Stories` };
}

export default async function StoriesAreaPage({
  params,
}: {
  params: Promise<{ area: string }>;
}) {
  const { area } = await params;
  const category = await getCategoryBySlug(area);

  if (!category) notFound();

  const [posts, allCategories, allTags] = await Promise.all([
    getPostsByCategory(category.id),
    getCategories(),
    getTags(),
  ]);

  const parent = allCategories.find((c) => c.slug === "stories");
  const siblings = parent ? allCategories.filter((c) => c.parent === parent.id) : [];
  const categoriesById = new Map(allCategories.map((c) => [c.id, c]));
  const tagsById = new Map(allTags.map((t) => [t.id, t]));

  return (
    <>
      <CategoryMiniNav basePath="/stories" categories={siblings} />
      <main className="container">
        <h1>{category.name}</h1>
        <ContentList items={posts} categoriesById={categoriesById} tagsById={tagsById} />
      </main>
    </>
  );
}
