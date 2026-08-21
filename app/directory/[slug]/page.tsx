import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDirectoryListingBySlug, getDirectoryListings, getFeaturedImage } from "@/lib/wordpress";

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
  const listing = await getDirectoryListingBySlug(slug);
  if (!listing) return {};
  return { title: `${listing.title.rendered} — Directory — Secret Carshalton` };
}

export default async function DirectoryListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await getDirectoryListingBySlug(slug);

  if (!listing) notFound();

  const image = getFeaturedImage(listing);
  const { meta } = listing;
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
      <div className="post-body">
        {image && <img src={image.source_url} alt={image.alt_text} />}
        <h1 dangerouslySetInnerHTML={{ __html: listing.title.rendered }} />
        <div className="directory-badges">
          {meta.sc_featured && <span className="directory-badge">Featured</span>}
          {meta.sc_verified && <span className="directory-badge directory-badge-verified">Verified</span>}
        </div>
        <div className="post-content" dangerouslySetInnerHTML={{ __html: listing.content.rendered }} />
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
