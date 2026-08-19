import Link from "next/link";
import { getCategories, getCategoryBySlug } from "@/lib/wordpress";

export const revalidate = 3600;

export default async function StoriesPage() {
  const parent = await getCategoryBySlug("stories");
  const categories = await getCategories();
  const areas = parent ? categories.filter((c) => c.parent === parent.id) : [];

  return (
    <main className="container">
      <h1>Stories</h1>
      <ul className="post-list">
        {areas.map((area) => (
          <li key={area.id}>
            <Link href={`/stories/${area.slug}`}>{area.name}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
