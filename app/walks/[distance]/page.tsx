import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { CategoryMiniNav } from "@/app/_components/CategoryMiniNav";
import { ContentList } from "@/app/_components/ContentList";
import { MobileTopAd } from "@/app/_components/MobileTopAd";
import { Pagination } from "@/app/_components/Pagination";
import { SidebarAds } from "@/app/_components/SidebarAds";
import { paginate, parsePageParam } from "@/lib/pagination";
import {
  getAd,
  getCategories,
  getCategoryBySlug,
  getFeaturedListingForGrid,
  getPostsByCategory,
  getTags,
  stripHtml,
} from "@/lib/wordpress";

export const revalidate = 3600;

export async function generateStaticParams() {
  const parent = await getCategoryBySlug("walks").catch(() => null);
  if (!parent) return [];
  const categories = await getCategories().catch(() => []);
  return categories.filter((c) => c.parent === parent.id && c.count > 0).map((c) => ({ distance: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ distance: string }>;
}): Promise<Metadata> {
  const { distance } = await params;
  const category = await getCategoryBySlug(distance).catch(() => null);
  if (!category) return {};
  const title = `${category.name} — Walks`;
  const description = stripHtml(category.description) || undefined;
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function WalksDistancePage({
  params,
  searchParams,
}: {
  params: Promise<{ distance: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { distance } = await params;
  const { page: rawPage } = await searchParams;
  const category = await getCategoryBySlug(distance).catch(() => null);

  if (!category) notFound();

  const [posts, allCategories, allTags, sidebarAd1, sidebarAd2, sidebarAd3, featuredListing] = await Promise.all([
    getPostsByCategory(category.id).catch(() => []),
    getCategories().catch(() => []),
    getTags().catch(() => []),
    getAd("sidebar", 1),
    getAd("sidebar", 2),
    getAd("sidebar", 3),
    getFeaturedListingForGrid(),
  ]);

  const parent = allCategories.find((c) => c.slug === "walks");
  const siblings = parent ? allCategories.filter((c) => c.parent === parent.id && c.count > 0) : [];
  const categoriesById = new Map(allCategories.map((c) => [c.id, c]));
  const tagsById = new Map(allTags.map((t) => [t.id, t]));
  // 10 total squares on a full page, not the shared PAGE_SIZE (9) — this
  // grid is 2 columns on desktop, and 9 alone always leaves one card as a
  // widow on its own row. ContentList adds the featured listing as an
  // extra card on top of the posts (not a swap), so when one's present
  // the post count drops to 9 to keep the total at 10 either way. Rob's
  // call (2026-10): keep the familiar 2-column card size — make 10 the
  // rule instead of narrowing to 3 columns to fit 9.
  const pageSize = featuredListing ? 9 : 10;
  const { items: pagePosts, page, totalPages } = paginate(posts, parsePageParam(rawPage), pageSize);

  return (
    <>
      <CategoryMiniNav basePath="/walks" categories={siblings} />
      <main className="container">
        <h1>
          {category.name}
          <CategoryKeyIcon />
        </h1>
        <MobileTopAd ad={sidebarAd1} />
        <div className="post-layout">
          <div className="post-body">
            <ContentList
              items={pagePosts}
              categoriesById={categoriesById}
              tagsById={tagsById}
              featuredListing={featuredListing}
              className="post-list-two-column"
            />
            <Pagination page={page} totalPages={totalPages} buildHref={(p) => `/walks/${distance}?page=${p}`} />
          </div>
          <aside className="post-sidebar">
            <SidebarAds ads={[sidebarAd1, sidebarAd2, sidebarAd3]} hideFirstOnMobile />
          </aside>
        </div>
      </main>
    </>
  );
}
