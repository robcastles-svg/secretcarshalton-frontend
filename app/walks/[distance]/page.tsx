import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategories, getCategoryBySlug, stripHtml, soft } from "@/lib/wordpress";
import { WalksView } from "../_components/WalksView";

export const revalidate = 3600;

export async function generateStaticParams() {
  const parent = await getCategoryBySlug("walks").catch(soft(null));
  if (!parent) return [];
  const categories = await getCategories().catch(soft([]));
  return categories.filter((c) => c.parent === parent.id && c.count > 0).map((c) => ({ distance: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ distance: string }>;
}): Promise<Metadata> {
  const { distance } = await params;
  const category = await getCategoryBySlug(distance).catch(soft(null));
  if (!category) return {};
  const title = `${category.name} — Walks`;
  const description = stripHtml(category.description) || undefined;
  return {
    title,
    description,
    alternates: { canonical: `/walks/${distance}` },
    openGraph: { title, description },
  };
}

/** A distance's walks, in the Walks page's look with this distance picked (see WalksView). */
export default async function WalksDistancePage({
  params,
  searchParams,
}: {
  params: Promise<{ distance: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { distance } = await params;
  const { page: rawPage } = await searchParams;
  const category = await getCategoryBySlug(distance).catch(soft(null));

  if (!category) notFound();

  return <WalksView distance={category} rawPage={rawPage} />;
}
