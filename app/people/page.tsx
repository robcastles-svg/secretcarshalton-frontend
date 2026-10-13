import { permanentRedirect } from "next/navigation";

/** Business Spotlight's posts now live at /spotlight (same posts, Discover look). */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  permanentRedirect(`/spotlight${page ? `?page=${encodeURIComponent(page)}` : ""}`);
}
