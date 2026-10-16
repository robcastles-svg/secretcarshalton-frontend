import type { Metadata } from "next";
import { DiscoverView } from "../discover/_components/DiscoverView";

export const revalidate = 3600;

// The same feed as /discover, so search engines are pointed there.
export const metadata: Metadata = {
  title: "Stories — Secret Carshalton",
  alternates: { canonical: "/discover" },
};

/** Every area's stories as cards, exactly as /discover shows them (Rob, Oct 2026), not a list of areas. */
export default async function StoriesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams;
  return <DiscoverView rawPage={page} basePath="/stories" />;
}
