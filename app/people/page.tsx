import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { ContentList } from "@/app/_components/ContentList";
import { getCategoryBySlug, getPostsByCategory } from "@/lib/wordpress";

export const revalidate = 3600;

export default async function PeoplePage() {
  const category = await getCategoryBySlug("people").catch(() => null);
  const posts = category ? await getPostsByCategory(category.id).catch(() => []) : [];

  return (
    <main className="container">
      <h1>
        Business Spotlight
        <CategoryKeyIcon />
      </h1>
      <ContentList items={posts} />
    </main>
  );
}
