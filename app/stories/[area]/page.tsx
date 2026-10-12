import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategories, getCategoryBySlug, stripHtml, soft } from "@/lib/wordpress";
import { DiscoverView } from "../../discover/_components/DiscoverView";

export const revalidate = 3600;

export async function generateStaticParams() {
  const parent = await getCategoryBySlug("stories").catch(soft(null));
  if (!parent) return [];
  const categories = await getCategories().catch(soft([]));
  return categories.filter((c) => c.parent === parent.id && c.count > 0).map((c) => ({ area: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ area: string }>;
}): Promise<Metadata> {
  const { area } = await params;
  const category = await getCategoryBySlug(area).catch(soft(null));
  if (!category) return {};
  const title = `${category.name} — Stories`;
  const description = stripHtml(category.description) || undefined;
  return {
    title,
    description,
    alternates: { canonical: `/stories/${area}` },
    openGraph: { title, description },
  };
}

/** An area's stories, in the Discover page's look with this area picked (see DiscoverView). */
export default async function StoriesAreaPage({
  params,
  searchParams,
}: {
  params: Promise<{ area: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { area } = await params;
  const { page: rawPage } = await searchParams;
  const category = await getCategoryBySlug(area).catch(soft(null));

  if (!category) notFound();

  return <DiscoverView area={category} rawPage={rawPage} />;
}
