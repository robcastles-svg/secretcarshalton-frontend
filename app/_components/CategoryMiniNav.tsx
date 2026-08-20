import Link from "next/link";
import type { WPCategory } from "@/lib/wordpress";

/** Hidden on mobile per the brief's screenshots — desktop-only quick jump. */
export function CategoryMiniNav({
  basePath,
  categories,
}: {
  basePath: string;
  categories: WPCategory[];
}) {
  return (
    <nav className="mini-category-nav">
      <div className="container mini-category-nav-inner">
        {categories.map((c) => (
          <Link key={c.id} href={`${basePath}/${c.slug}`}>
            {c.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
