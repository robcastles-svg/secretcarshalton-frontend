import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentList } from "@/app/_components/ContentList";
import { getCategories, getCategoryBySlug, getPostsByCategory } from "@/lib/wordpress";

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

  const posts = await getPostsByCategory(category.id);

  return (
    <main className="container">
      <h1>{category.name}</h1>
      <ContentList items={posts} />
    </main>
  );
}
