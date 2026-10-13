import type { Metadata } from "next";
import { DiscoverView } from "@/app/discover/_components/DiscoverView";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Business Spotlight — Secret Carshalton",
  description: "Featured premium members of the Secret Carshalton directory.",
};

/**
 * Business Spotlight: the "people" category's posts, in the Discover look
 * (its secondary nav, two-column cards). Linked from the directory
 * homepage. /discover?filter=spotlight and the old /people page both
 * redirect here, so there's one address for it.
 */
export default async function SpotlightPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  return <DiscoverView filter="spotlight" rawPage={page} />;
}
