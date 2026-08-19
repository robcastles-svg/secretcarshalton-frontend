import Link from "next/link";
import { getCategories, getCategoryBySlug } from "@/lib/wordpress";

export const revalidate = 3600;

export default async function WalksPage() {
  const parent = await getCategoryBySlug("walks");
  const categories = await getCategories();
  const distances = parent ? categories.filter((c) => c.parent === parent.id) : [];

  return (
    <main className="container">
      <h1>Walks</h1>
      <ul className="post-list">
        {distances.map((distance) => (
          <li key={distance.id}>
            <Link href={`/walks/${distance.slug}`}>{distance.name}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
