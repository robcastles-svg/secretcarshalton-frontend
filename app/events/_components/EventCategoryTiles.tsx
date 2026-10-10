import { Fragment } from "react";
import Link from "next/link";
import type { WPScEventCategory } from "@/lib/wordpress";

/**
 * The area links bar (All events / What's On in Carshalton / Sutton /
 * Outside Sutton). Renders as plain links directly into the parent
 * .secondary-nav row — no wrapper of its own, so the pipe-divider styling
 * there applies uninterrupted. Each area category's slug is also its
 * page address (/whats-on-in-carshalton etc).
 */
export function EventCategoryTiles({
  categories,
  activeSlug,
}: {
  categories: WPScEventCategory[];
  activeSlug?: string;
}) {
  if (categories.length === 0) return null;

  return (
    <Fragment>
      <Link href="/events" className={!activeSlug ? "active" : undefined}>
        All events
      </Link>
      {categories.map((c) => (
        <Link key={c.id} href={`/${c.slug}`} className={activeSlug === c.slug ? "active" : undefined}>
          {c.name}
        </Link>
      ))}
    </Fragment>
  );
}
