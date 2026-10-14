import type { Metadata } from "next";
import { ListingDetail, listingMetadata } from "@/app/directory/[slug]/_components/ListingDetail";
import { getDirectoryCategories, soft } from "@/lib/wordpress";

export const revalidate = 3600;

/**
 * A community group's own page, in the Community section (the main menu
 * highlights Community from the address). Same page as a business
 * listing's (ListingDetail), without the Spotlight articles; a business
 * listing's slug here redirects to its /directory address.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return listingMetadata(slug, `/community/groups/${slug}`);
}

export default async function CommunityGroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categories = await getDirectoryCategories().catch(soft([]));
  return <ListingDetail slug={slug} categories={categories} section="community" />;
}
