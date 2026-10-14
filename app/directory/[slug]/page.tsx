import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { DirectoryBrowse } from "../_components/DirectoryBrowse";
import { ListingDetail, isGroupListing, listingMetadata } from "./_components/ListingDetail";
import {
  getDirectoryCategories,
  getDirectoryListings,
  GROUPS_CATEGORY_SLUG,
  stripHtml,
  soft,
} from "@/lib/wordpress";

export const revalidate = 3600;

/**
 * This one dynamic segment does double duty: a real, crawlable page per
 * directory category (/directory/pets) for SEO, same reasoning as
 * /stories/[area] and /walks/[distance] — "someone searching pets in the
 * area" should land on a dedicated page, not a ?category= query string —
 * as well as every individual listing's detail page (/directory/the-coffee-shop).
 * Category slugs are a small, fixed, Rob-controlled set; a listing could in
 * principle pick the exact same slug (e.g. a business literally named
 * "Pets"), in which case the category page wins — see the page component
 * below, which checks categories first.
 */
export async function generateStaticParams() {
  try {
    const [listings, categories] = await Promise.all([getDirectoryListings(), getDirectoryCategories()]);
    const categorySlugs = categories
      .filter((c) => c.slug !== GROUPS_CATEGORY_SLUG)
      .map((c) => ({ slug: c.slug }));
    // Community groups live at /community/groups/{slug} instead.
    const businesses = listings.filter((l) => !isGroupListing(l, categories));
    return [...categorySlugs, ...businesses.map((l) => ({ slug: l.slug }))];
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const category = await getDirectoryCategories()
    .then((cats) => cats.find((c) => c.slug === slug && c.slug !== GROUPS_CATEGORY_SLUG))
    .catch(() => undefined);
  if (category) {
    const title = `${category.name} — The Sutton Business Directory`;
    const description = stripHtml(category.description) || undefined;
    return {
      title,
      description,
      alternates: { canonical: `/directory/${slug}` },
      openGraph: { title, description },
    };
  }

  return listingMetadata(slug, `/directory/${slug}`);
}

export default async function DirectoryListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>;
}) {
  const { slug } = await params;
  // Groups to join is its own Community page now.
  if (slug === GROUPS_CATEGORY_SLUG) permanentRedirect("/community/groups");

  const categories = await getDirectoryCategories().catch(soft([]));
  const category = categories.find((c) => c.slug === slug && c.slug !== GROUPS_CATEGORY_SLUG);
  if (category) {
    const { q: rawQ, sort: rawSort, page: rawPage } = await searchParams;
    return (
      <DirectoryBrowse
        activeCategory={category}
        q={(rawQ ?? "").trim()}
        sort={rawSort ?? "newest"}
        rawPage={rawPage}
      />
    );
  }

  return <ListingDetail slug={slug} categories={categories} section="directory" />;
}
