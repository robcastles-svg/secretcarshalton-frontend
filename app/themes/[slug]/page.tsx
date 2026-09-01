import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { ContentList } from "@/app/_components/ContentList";
import { Pagination } from "@/app/_components/Pagination";
import { paginate, parsePageParam } from "@/lib/pagination";
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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: rawPage } = await searchParams;
  const tag = await getTagBySlug(slug).catch(() => null);

  if (!tag) notFound();

  const [posts, allCategories, allTags] = await Promise.all([
    getPostsByTag(tag.id).catch(() => []),
    getCategories().catch(() => []),
    getTags().catch(() => []),
  ]);

  const categoriesById = new Map(allCategories.map((c) => [c.id, c]));
  const tagsById = new Map(allTags.map((t) => [t.id, t]));
  const { items: pagePosts, page, totalPages } = paginate(posts, parsePageParam(rawPage));

  return (
    <main className="container">
      <span className="theme-eyebrow">Stories by theme</span>
      <h1>
        {tag.name}
        <CategoryKeyIcon />
      </h1>
      {posts.length === 0 && <p>No stories tagged &quot;{tag.name}&quot; yet.</p>}
      <ContentList items={pagePosts} categoriesById={categoriesById} tagsById={tagsById} />
      <Pagination page={page} totalPages={totalPages} buildHref={(p) => `/themes/${slug}?page=${p}`} />
    </main>
  );
}
