import Link from "next/link";
import {
  getDirectoryCategories,
  getDirectoryListings,
  getDirectoryListingsByCategory,
  getFeaturedImage,
  stripHtml,
} from "@/lib/wordpress";

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

  const listings = await (activeCategory
    ? getDirectoryListingsByCategory(activeCategory.id)
    : getDirectoryListings()
  ).catch(() => []);

  return (
    <main className="container">
      <div className="page-header-row">
        <div>
          <h1>Directory</h1>
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

      {listings.length === 0 ? (
        <p className="directory-empty">
          No listings here yet — the directory is being rebuilt; real listings are on the way.
        </p>
      ) : (
        <ul className="post-list directory-list">
          {listings.map((listing) => {
            const image = getFeaturedImage(listing);
            return (
              <li key={listing.id}>
                <Link href={`/directory/${listing.slug}`}>
                  {image && <img src={image.source_url} alt={image.alt_text} loading="lazy" />}
                  <span className="card-title" dangerouslySetInnerHTML={{ __html: listing.title.rendered }} />
                </Link>
                {listing.meta.sc_featured && <span className="directory-badge">Featured</span>}
                <p>{stripHtml(listing.content.rendered).slice(0, 120)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
