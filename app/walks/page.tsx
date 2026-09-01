import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { getCategories, getCategoryBySlug } from "@/lib/wordpress";

export const revalidate = 3600;

export default async function WalksPage() {
  const parent = await getCategoryBySlug("walks").catch(() => null);
  const categories = await getCategories().catch(() => []);
  const distances = parent ? categories.filter((c) => c.parent === parent.id && c.count > 0) : [];

  return (
    <main className="container">
      <h1>
        Walks
        <CategoryKeyIcon />
      </h1>
      <ul className="link-list">
        {distances.map((distance) => (
          <li key={distance.id}>
            <Link href={`/walks/${distance.slug}`}>{distance.name}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
