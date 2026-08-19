import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentList } from "@/app/_components/ContentList";
import { getCategories, getCategoryBySlug, getPostsByCategory } from "@/lib/wordpress";

export const revalidate = 3600;

export async function generateStaticParams() {
  const parent = await getCategoryBySlug("walks");
  if (!parent) return [];
  const categories = await getCategories();
  return categories.filter((c) => c.parent === parent.id).map((c) => ({ distance: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ distance: string }>;
}): Promise<Metadata> {
  const { distance } = await params;
  const category = await getCategoryBySlug(distance);
  if (!category) return {};
  return { title: `${category.name} — Walks` };
}

export default async function WalksDistancePage({
  params,
}: {
  params: Promise<{ distance: string }>;
}) {
  const { distance } = await params;
  const category = await getCategoryBySlug(distance);

  if (!category) notFound();

  const posts = await getPostsByCategory(category.id);

  return (
    <main className="container">
      <h1>{category.name}</h1>
      <ContentList items={posts} />
    </main>
  );
}
