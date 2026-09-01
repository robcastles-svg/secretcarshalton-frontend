import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { DirectoryListingCard } from "@/app/_components/DirectoryListingCard";
import { DirectoryControls } from "./_components/DirectoryControls";
import { getDirectoryCategories, getDirectoryListings, getDirectoryListingsByCategory, stripHtml, type WPListing } from "@/lib/wordpress";

export const revalidate = 3600;

export const metadata = { title: "The Sutton Business Directory — Secret Carshalton" };

function matchesQuery(listing: WPListing, q: string) {
  if (!q) return true;
  const haystack = `${stripHtml(listing.title.rendered)} ${listing.meta.sc_tagline ?? ""}`.toLowerCase();
  return haystack.includes(q.toLowerCase());
}

/**
 * "Random" is stable for the length of the ISR cache window (revalidate
 * above) rather than truly per-visit — the rendered HTML is what's
 * cached, so every visitor hitting this URL within that hour sees the
 * same shuffled order. Effectively "reshuffled hourly," which is fine
 * for browsing variety without needing per-request rendering.
 */
function sortListings(listings: WPListing[], sort: string) {
  const sorted = [...listings];
  switch (sort) {
    case "oldest":
      return sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    case "title":
      return sorted.sort((a, b) => stripHtml(a.title.rendered).localeCompare(stripHtml(b.title.rendered)));
    case "random":
      return sorted.sort(() => Math.random() - 0.5);
    case "reviews":
      return sorted.sort((a, b) => (b.sc_review_stats?.count ?? 0) - (a.sc_review_stats?.count ?? 0));
    case "rating":
      return sorted.sort((a, b) => (b.sc_review_stats?.average ?? 0) - (a.sc_review_stats?.average ?? 0));
    case "newest":
    default:
      return sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; sort?: string }>;
}) {
  const { category, q: rawQ, sort: rawSort } = await searchParams;
  const q = (rawQ ?? "").trim();
  const sort = rawSort ?? "newest";

  // Staging (which this reads from — see lib/wordpress.ts's WP_STAGING_ROOT
  // note) has proven unreliable to reach from Vercel's runtime; never let
  // that hang or crash this page — an empty directory is recoverable, a
  // dead page isn't.
  const categories = await getDirectoryCategories().catch(() => []);
  const activeCategory = category ? categories.find((c) => c.slug === category) : null;

  const rawListings = await (activeCategory
    ? getDirectoryListingsByCategory(activeCategory.id)
    : getDirectoryListings()
  ).catch(() => []);

  const filteredListings = rawListings.filter((l) => matchesQuery(l, q));

  // Featured listings get their own row above the rest — both on the
  // unfiltered "All" view and within whichever category is being browsed.
  // Sorting featured-first into one shared masonry list (the previous
  // approach) only put them at the top of the *first* CSS column on
  // desktop, since column-based masonry fills one column fully before
  // starting the next — splitting them into a separate, non-masonry grid
  // is what actually gets every featured listing into the top row.
  const featuredListings = sortListings(filteredListings.filter((l) => l.meta.sc_featured), sort);
  const regularListings = sortListings(filteredListings.filter((l) => !l.meta.sc_featured), sort);

  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  return (
    <>
      <div className="secondary-nav-bar">
        <nav className="container secondary-nav">
          <Link href="/directory" className={!activeCategory ? "active" : undefined}>
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/directory?category=${c.slug}`}
              className={activeCategory?.id === c.id ? "active" : undefined}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      </div>

      <main className="container">
      <div className="page-header-row">
        <div>
          <h1>
            The Sutton Business Directory
            <CategoryKeyIcon />
          </h1>
          <p>Local businesses and organisations in and around Carshalton.</p>
        </div>
        <Link href="/directory/submit" className="button-pill">
          Add a listing
        </Link>
      </div>

      <div className="directory-toolbar">
        <DirectoryControls category={category ?? ""} q={q} sort={sort} />
      </div>

      {featuredListings.length === 0 && regularListings.length === 0 ? (
        <p className="directory-empty">
          {q
            ? `No listings match "${q}" — try a different search or clear it to see everything.`
            : "No listings here yet — the directory is being rebuilt; real listings are on the way."}
        </p>
      ) : (
        <>
          {featuredListings.length > 0 && (
            <ul className="post-list directory-featured-list">
              {featuredListings.map((listing) => (
                <DirectoryListingCard
                  key={listing.id}
                  listing={listing}
                  categoriesList={
                    listing.sc_listing_category
                      ?.map((id) => categoriesById.get(id))
                      .filter((c): c is (typeof categories)[number] => Boolean(c))
                  }
                />
              ))}
            </ul>
          )}

          {regularListings.length > 0 && (
            <ul className="post-list directory-list">
              {regularListings.map((listing) => (
                <DirectoryListingCard
                  key={listing.id}
                  listing={listing}
                  categoriesList={
                    listing.sc_listing_category
                      ?.map((id) => categoriesById.get(id))
                      .filter((c): c is (typeof categories)[number] => Boolean(c))
                  }
                />
              ))}
            </ul>
          )}
        </>
      )}
      </main>
    </>
  );
}
