import { redirect } from "next/navigation";
import { DirectoryBrowse } from "./_components/DirectoryBrowse";

export const revalidate = 3600;

export const metadata = { title: "The Sutton Business Directory — Secret Carshalton" };

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; sort?: string; page?: string }>;
}) {
  const { category, q: rawQ, sort: rawSort, page: rawPage } = await searchParams;

  // Category browsing used to live here as ?category=slug — now every
  // category has its own real page (/directory/[slug]) for SEO, so an old
  // bookmarked or indexed ?category= link is redirected there instead of
  // rendering a second, query-string copy of the same content.
  if (category) {
    const params = new URLSearchParams();
    if (rawQ) params.set("q", rawQ);
    if (rawSort) params.set("sort", rawSort);
    if (rawPage) params.set("page", rawPage);
    const qs = params.toString();
    redirect(`/directory/${category}${qs ? `?${qs}` : ""}`);
  }

  const q = (rawQ ?? "").trim();
  const sort = rawSort ?? "newest";

  return <DirectoryBrowse activeCategory={null} q={q} sort={sort} rawPage={rawPage} />;
}
