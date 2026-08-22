import Link from "next/link";
import type { WPScEventTag } from "@/lib/wordpress";

export function EventTagTiles({
  tags,
  activeSlug,
  activeCategorySlug,
}: {
  tags: WPScEventTag[];
  activeSlug?: string;
  activeCategorySlug?: string;
}) {
  if (tags.length === 0) return null;

  const categoryQuery = activeCategorySlug ? `&category=${activeCategorySlug}` : "";

  return (
    <div className="event-tag-tiles">
      <Link
        href={activeCategorySlug ? `/events?category=${activeCategorySlug}` : "/events"}
        className={!activeSlug ? "active" : undefined}
      >
        All topics
      </Link>
      {tags.map((t) => (
        <Link
          key={t.id}
          href={`/events?tag=${t.slug}${categoryQuery}`}
          className={activeSlug === t.slug ? "active" : undefined}
        >
          {t.name}
        </Link>
      ))}
    </div>
  );
}
