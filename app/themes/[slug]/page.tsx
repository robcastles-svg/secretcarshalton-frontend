import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentList } from "@/app/_components/ContentList";
import { getCategories, getPostsByTag, getTagBySlug, getTags } from "@/lib/wordpress";

export const revalidate = 3600;

export async function generateStaticParams() {
  const tags = await getTags().catch(() => []);
  return tags.filter((t) => t.count === undefined || t.count > 0).map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getTagBySlug(slug).catch(() => null);
  if (!tag) return {};
  return { title: `${tag.name} — Stories by theme — Secret Carshalton` };
}

export default async function ThemePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tag = await getTagBySlug(slug).catch(() => null);

  if (!tag) notFound();

  const [posts, allCategories, allTags] = await Promise.all([
    getPostsByTag(tag.id).catch(() => []),
    getCategories().catch(() => []),
    getTags().catch(() => []),
  ]);

  const categoriesById = new Map(allCategories.map((c) => [c.id, c]));
  const tagsById = new Map(allTags.map((t) => [t.id, t]));

  return (
    <main className="container">
      <span className="theme-eyebrow">Stories by theme</span>
      <h1>{tag.name}</h1>
      {posts.length === 0 && <p>No stories tagged &quot;{tag.name}&quot; yet.</p>}
      <ContentList items={posts} categoriesById={categoriesById} tagsById={tagsById} />
    </main>
  );
}
