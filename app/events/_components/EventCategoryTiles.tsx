import Link from "next/link";
import type { WPScEventCategory } from "@/lib/wordpress";

export function EventCategoryTiles({
  categories,
  activeSlug,
  activeTagSlug,
}: {
  categories: WPScEventCategory[];
  activeSlug?: string;
  activeTagSlug?: string;
}) {
  if (categories.length === 0) return null;

  const tagQuery = activeTagSlug ? `&tag=${activeTagSlug}` : "";

  return (
    <div className="event-category-tiles">
      <Link
        href={activeTagSlug ? `/events?tag=${activeTagSlug}` : "/events"}
        className={!activeSlug ? "active" : undefined}
      >
        All events
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/events?category=${c.slug}${tagQuery}`}
          className={activeSlug === c.slug ? "active" : undefined}
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}
