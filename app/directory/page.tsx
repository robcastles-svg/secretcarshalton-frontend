import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { DirectoryListingCard } from "@/app/_components/DirectoryListingCard";
import { getDirectoryCategories, getDirectoryListings, getDirectoryListingsByCategory } from "@/lib/wordpress";

export const revalidate = 3600;

export const metadata = { title: "Directory — Secret Carshalton" };

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
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

  // Featured listings get their own row above the rest — both on the
  // unfiltered "All" view and within whichever category is being browsed.
  // Sorting featured-first into one shared masonry list (the previous
  // approach) only put them at the top of the *first* CSS column on
  // desktop, since column-based masonry fills one column fully before
  // starting the next — splitting them into a separate, non-masonry grid
  // is what actually gets every featured listing into the top row.
  const featuredListings = rawListings.filter((l) => l.meta.sc_featured);
  const regularListings = rawListings.filter((l) => !l.meta.sc_featured);

  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  return (
    <main className="container">
      <div className="page-header-row">
        <div>
          <h1>
            Directory
            <CategoryKeyIcon />
          </h1>
          <p>Local businesses and organisations in and around Carshalton.</p>
        </div>
        <Link href="/directory/submit" className="button-pill">
          Add a listing
        </Link>
      </div>

      <nav className="directory-category-nav">
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

      {featuredListings.length === 0 && regularListings.length === 0 ? (
        <p className="directory-empty">
          No listings here yet — the directory is being rebuilt; real listings are on the way.
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
  );
}
