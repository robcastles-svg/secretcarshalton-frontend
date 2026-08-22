import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
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

  const rawListings = await (activeCategory
    ? getDirectoryListingsByCategory(activeCategory.id)
    : getDirectoryListings()
  ).catch(() => []);

  // Featured listings first — both on the unfiltered "All" view and within
  // whichever category is being browsed, per how featuring is meant to work.
  const listings = [...rawListings].sort((a, b) => Number(b.meta.sc_featured) - Number(a.meta.sc_featured));

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

      {listings.length === 0 ? (
        <p className="directory-empty">
          No listings here yet — the directory is being rebuilt; real listings are on the way.
        </p>
      ) : (
        <ul className="post-list directory-list">
          {listings.map((listing) => {
            const image = getFeaturedImage(listing);
            const verified = listing.meta.sc_claimed || listing.meta.sc_verified;
            return (
              <li key={listing.id}>
                <Link href={`/directory/${listing.slug}`}>
                  {image && <img src={image.source_url} alt={image.alt_text} loading="lazy" />}
                  <span className="card-title">
                    {verified && (
                      <svg
                        className="directory-verified-check directory-verified-check-sm"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-label="Verified listing"
                      >
                        <circle cx="12" cy="12" r="10" fill="#0a5c36" />
                        <path d="M7 12.5l3 3 7-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    <span dangerouslySetInnerHTML={{ __html: listing.title.rendered }} />
                  </span>
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
