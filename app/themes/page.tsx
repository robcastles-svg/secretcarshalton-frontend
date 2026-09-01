import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { getTags } from "@/lib/wordpress";

export const revalidate = 3600;
export const metadata = { title: "Stories by theme — Secret Carshalton" };

export default async function ThemesPage() {
  const tags = await getTags().catch(() => []);
  const themes = tags.filter((t) => t.count === undefined || t.count > 0);

  return (
    <main className="container">
      <h1>
        Stories by theme
        <CategoryKeyIcon />
      </h1>
      <ul className="theme-index-list">
        {themes.map((t) => (
          <li key={t.id}>
            <Link href={`/themes/${t.slug}`}>{t.name}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
