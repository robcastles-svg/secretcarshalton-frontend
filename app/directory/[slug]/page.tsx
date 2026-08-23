import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClaimListingButton } from "./_components/ClaimListingButton";
import { getSessionToken } from "@/lib/auth";
import {
  getDirectoryCategories,
  getDirectoryListingBySlug,
  getDirectoryListings,
  getFeaturedImage,
  getMemberMe,
} from "@/lib/wordpress";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const listings = await getDirectoryListings();
    return listings.map((l) => ({ slug: l.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getDirectoryListingBySlug(slug).catch(() => null);
  if (!listing) return {};
  return { title: `${listing.title.rendered} — Directory — Secret Carshalton` };
}

export default async function DirectoryListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [listing, categories, sessionToken] = await Promise.all([
    getDirectoryListingBySlug(slug).catch(() => null),
    getDirectoryCategories().catch(() => []),
    getSessionToken(),
  ]);

  if (!listing) notFound();

  const profile = sessionToken ? await getMemberMe(sessionToken) : null;
  const canEdit = Boolean(profile && (profile.id === listing.author || profile.is_editor));

  const image = getFeaturedImage(listing);
  const { meta } = listing;
  const verified = meta.sc_claimed || meta.sc_verified;
  const category = categories.find((c) => listing.sc_listing_category?.includes(c.id));
  const addressParts = [
    meta.sc_address_street,
    meta.sc_address_town,
    meta.sc_address_region,
    meta.sc_address_postcode,
  ].filter(Boolean);

  const businessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: listing.title.rendered,
    image: image ? image.source_url : undefined,
    url: meta.sc_website || undefined,
    telephone: meta.sc_phone || undefined,
    address: addressParts.length
      ? {
          "@type": "PostalAddress",
          streetAddress: meta.sc_address_street || undefined,
          addressLocality: meta.sc_address_town || undefined,
          addressRegion: meta.sc_address_region || undefined,
          postalCode: meta.sc_address_postcode || undefined,
          addressCountry: meta.sc_address_country || "GB",
        }
      : undefined,
  };

  return (
    <main className="container post-layout">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessSchema) }}
      />
      <div className="post-body directory-listing-card">
        {image && <img src={image.source_url} alt={image.alt_text} />}
        <div className="directory-listing-card-body">
          <div className="page-header-row">
            <h1>
              {verified && (
                <svg
                  className="directory-verified-check"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-label="Verified listing"
                >
                  <circle cx="12" cy="12" r="10" fill="#0a5c36" />
                  <path d="M7 12.5l3 3 7-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <span dangerouslySetInnerHTML={{ __html: listing.title.rendered }} />
            </h1>
            {canEdit && (
              <Link href={`/directory/${listing.slug}/edit`} className="button-pill button-pill-active">
                Edit listing
              </Link>
            )}
          </div>
          {(category || meta.sc_featured) && (
            <div className="directory-badges">
              {category && (
                <Link href={`/directory?category=${category.slug}`} className="directory-category-pill">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />
                  </svg>
                  {category.name}
                </Link>
              )}
              {meta.sc_featured && <span className="directory-badge">Featured</span>}
            </div>
          )}
          {!meta.sc_claimed && (
            <div className="directory-claim-row">
              <ClaimListingButton listingId={listing.id} isLoggedIn={Boolean(sessionToken)} />
            </div>
          )}
          <div className="post-content" dangerouslySetInnerHTML={{ __html: listing.content.rendered }} />
        </div>
      </div>
      <aside className="post-sidebar">
        <div className="sidebar-block">
          <h2>Details</h2>
          {addressParts.length > 0 && <p>{addressParts.join(", ")}</p>}
          {meta.sc_phone && <p>{meta.sc_phone}</p>}
          {meta.sc_website && (
            <p>
              <a href={meta.sc_website}>{meta.sc_website.replace(/^https?:\/\//, "")}</a>
            </p>
          )}
        </div>
      </aside>
    </main>
  );
}
