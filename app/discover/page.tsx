import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { getCategories, getCategoryBySlug } from "@/lib/wordpress";
import { DiscoverView } from "./_components/DiscoverView";

export const revalidate = 3600;

export const metadata: Metadata = { title: "Discover — Secret Carshalton" };

/** The stories area with this slug, if it is one. */
async function storiesArea(slug: string) {
  const [storiesParent, allCategories] = await Promise.all([
    getCategoryBySlug("stories").catch(() => null),
    getCategories().catch(() => []),
  ]);
  return storiesParent ? allCategories.find((c) => c.parent === storiesParent.id && c.slug === slug) : undefined;
}

/**
 * Discover: every area's stories merged, or the Spotlight / Business
 * feature filters. An area filter (?filter=cheam, the old links) now lives
 * at its own page, /stories/cheam, which looks the same — redirect there
 * so there's one address per area.
 */
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const { filter, page } = await searchParams;
  if (filter && filter !== "spotlight" && filter !== "featured") {
    const area = await storiesArea(filter);
    if (area) permanentRedirect(`/stories/${area.slug}${page ? `?page=${encodeURIComponent(page)}` : ""}`);
  }
  return <DiscoverView filter={filter} rawPage={page} />;
}
