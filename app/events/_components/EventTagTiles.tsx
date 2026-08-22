"use client";

import { useRouter } from "next/navigation";
import type { WPScEventTag } from "@/lib/wordpress";

/**
 * A dropdown, not a pill row — with 13 subject tags, the earlier tile
 * treatment (one pill per tag, always all visible) was the cluttered part
 * of the events page Rob flagged; category still gets tiles since there
 * are only 3 of those.
 */
export function EventTagTiles({
  tags,
  activeSlug,
  activeCategorySlug,
}: {
  tags: WPScEventTag[];
  activeSlug?: string;
  activeCategorySlug?: string;
}) {
  const router = useRouter();
  if (tags.length === 0) return null;

  const categoryQuery = activeCategorySlug ? `&category=${activeCategorySlug}` : "";

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    router.push(value ? `/events?tag=${value}${categoryQuery}` : activeCategorySlug ? `/events?category=${activeCategorySlug}` : "/events");
  }

  return (
    <div className="event-tag-dropdown">
      <label htmlFor="event-tag-select">Browse by topic</label>
      <select id="event-tag-select" value={activeSlug ?? ""} onChange={handleChange}>
        <option value="">All topics</option>
        {tags.map((t) => (
          <option key={t.id} value={t.slug}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
