import { NextResponse, type NextRequest } from "next/server";
import { AREAS, HIDDEN_TOPICS, LEGACY_FREE_TAG, listHref } from "@/lib/event-list";

const OLD_PARAMS = ["view", "category", "tag", "year", "month"];

/**
 * Redirects the old /events?… addresses (calendar view, month arrows,
 * area and topic filters) to the new list pages, permanently, so links
 * and search results carry over:
 *   ?year=2026&month=11      → /events/month/november-2026
 *   ?category=whats-on-in-…  → /whats-on-in-…
 *   ?tag=music               → /events/category/music (free-entry → free)
 *   ?view=calendar           → dropped (its month, if any, is kept)
 * Combinations follow listHref (e.g. tag + month → month page ?topic=).
 */
export function proxy(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  if (!OLD_PARAMS.some((p) => q.has(p))) return NextResponse.next();

  const category = q.get("category");
  const area = AREAS.find((a) => a.slug === category)?.slug ?? null;

  const tag = q.get("tag");
  const topic = tag === LEGACY_FREE_TAG ? "free" : tag && !HIDDEN_TOPICS.has(tag) && /^[a-z0-9-]+$/.test(tag) ? tag : null;

  const year = Number(q.get("year"));
  const month = Number(q.get("month"));
  const when =
    year >= 2000 && year <= 2100 && month >= 1 && month <= 12
      ? `${year}-${String(month).padStart(2, "0")}`
      : "all";

  return NextResponse.redirect(new URL(listHref({ area, when, topic }), request.url), 308);
}

export const config = {
  matcher: "/events",
};
