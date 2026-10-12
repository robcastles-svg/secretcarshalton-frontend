import { permanentRedirect } from "next/navigation";
import { getCategories, getCategoryBySlug, soft } from "@/lib/wordpress";
import { WalksView } from "./_components/WalksView";

export const revalidate = 3600;

/**
 * Every distance's walks merged. A distance filter (?filter=40-minutes-by-car,
 * the old links) now lives at its own page, /walks/40-minutes-by-car, which
 * looks the same — redirect there so there's one address per distance.
 */
export default async function WalksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const { filter, page } = await searchParams;
  if (filter) {
    const [parent, allCategories] = await Promise.all([
      getCategoryBySlug("walks").catch(soft(null)),
      getCategories().catch(soft([])),
    ]);
    const distance = parent && allCategories.find((c) => c.parent === parent.id && c.slug === filter);
    if (distance) permanentRedirect(`/walks/${distance.slug}${page ? `?page=${encodeURIComponent(page)}` : ""}`);
  }
  return <WalksView rawPage={page} />;
}
