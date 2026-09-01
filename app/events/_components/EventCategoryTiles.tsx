import { Fragment } from "react";
import Link from "next/link";
import type { WPScEventCategory } from "@/lib/wordpress";

/** Renders as plain links directly into the parent .secondary-nav row — no wrapper of its own, so the pipe-divider styling there applies uninterrupted. */
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
    <Fragment>
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
    </Fragment>
  );
}
