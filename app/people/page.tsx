import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { ContentList } from "@/app/_components/ContentList";
import { getCategories, getCategoryBySlug, getPostsByCategory, getTags } from "@/lib/wordpress";

export const revalidate = 3600;

export default async function PeoplePage() {
  const [category, allCategories, allTags] = await Promise.all([
    getCategoryBySlug("people").catch(() => null),
    getCategories().catch(() => []),
    getTags().catch(() => []),
  ]);
  const posts = category ? await getPostsByCategory(category.id).catch(() => []) : [];
  const categoriesById = new Map(allCategories.map((c) => [c.id, c]));
  const tagsById = new Map(allTags.map((t) => [t.id, t]));

  return (
    <main className="container">
      <h1>
        Business Spotlight
        <CategoryKeyIcon />
      </h1>
      <ContentList items={posts} categoriesById={categoriesById} tagsById={tagsById} />
    </main>
  );
}
