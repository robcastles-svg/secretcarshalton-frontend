import Link from "next/link";
import type { WPScEventCategory } from "@/lib/wordpress";

export function EventCategoryTiles({
  categories,
  activeSlug,
}: {
  categories: WPScEventCategory[];
  activeSlug?: string;
}) {
  if (categories.length === 0) return null;

  return (
    <div className="event-category-tiles">
      <Link href="/events" className={!activeSlug ? "active" : undefined}>
        All events
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/events?category=${c.slug}`}
          className={activeSlug === c.slug ? "active" : undefined}
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}
