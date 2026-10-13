import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { getCategories, getCategoryBySlug, soft } from "@/lib/wordpress";
import { DiscoverView } from "./_components/DiscoverView";

export const revalidate = 3600;

export const metadata: Metadata = { title: "Discover — Secret Carshalton" };

/** The stories area with this slug, if it is one. */
async function storiesArea(slug: string) {
  const [storiesParent, allCategories] = await Promise.all([
    getCategoryBySlug("stories").catch(soft(null)),
    getCategories().catch(soft([])),
  ]);
  return storiesParent ? allCategories.find((c) => c.parent === storiesParent.id && c.slug === slug) : undefined;
}

/**
 * Discover: every area's stories merged, or the Business feature filter.
 * Spotlight (?filter=spotlight, the old links) now has its own address,
 * /spotlight. An area filter (?filter=cheam, the old links) now lives
 * at its own page, /stories/cheam, which looks the same — redirect there
 * so there's one address per area.
 */
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const { filter, page } = await searchParams;
  const pageQuery = page ? `?page=${encodeURIComponent(page)}` : "";
  if (filter === "spotlight") permanentRedirect(`/spotlight${pageQuery}`);
  if (filter && filter !== "featured") {
    const area = await storiesArea(filter);
    if (area) permanentRedirect(`/stories/${area.slug}${pageQuery}`);
  }
  return <DiscoverView filter={filter} rawPage={page} />;
}
