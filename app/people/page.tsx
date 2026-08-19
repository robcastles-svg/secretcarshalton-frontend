import { ContentList } from "@/app/_components/ContentList";
import { getCategoryBySlug, getPostsByCategory } from "@/lib/wordpress";

export const revalidate = 3600;

export default async function PeoplePage() {
  const category = await getCategoryBySlug("people");
  const posts = category ? await getPostsByCategory(category.id) : [];

  return (
    <main className="container">
      <h1>In the Spotlight</h1>
      <ContentList items={posts} />
    </main>
  );
}
