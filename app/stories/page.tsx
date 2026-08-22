import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { getCategories, getCategoryBySlug } from "@/lib/wordpress";

export const revalidate = 3600;

export default async function StoriesPage() {
  const parent = await getCategoryBySlug("stories").catch(() => null);
  const categories = await getCategories().catch(() => []);
  const areas = parent ? categories.filter((c) => c.parent === parent.id && c.count > 0) : [];

  return (
    <main className="container">
      <h1>
        Stories
        <CategoryKeyIcon />
      </h1>
      <ul className="link-list">
        {areas.map((area) => (
          <li key={area.id}>
            <Link href={`/stories/${area.slug}`}>{area.name}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
