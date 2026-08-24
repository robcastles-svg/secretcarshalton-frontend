import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentCountLink } from "@/app/_components/CommentCountLink";
import { CommentSection } from "@/app/_components/CommentSection";
import { DirectoryImageSlider } from "@/app/_components/DirectoryImageSlider";
import { PostViewTracker } from "@/app/_components/PostViewTracker";
import { listingSocials } from "@/app/_components/SocialIcons";
import { ClaimListingButton } from "./_components/ClaimListingButton";
import { getSessionToken } from "@/lib/auth";
import {
  getCommentsForPost,
  getDirectoryCategories,
  getDirectoryListingBySlug,
  getDirectoryListings,
  getFeaturedImage,
  getMemberMe,
  getMembersByIds,
  getPostViewCount,
  stripHtml,
} from "@/lib/wordpress";

function formatListedSince(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

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

  const [profile, fullThread, viewCount] = await Promise.all([
    sessionToken ? getMemberMe(sessionToken) : Promise.resolve(null),
    getCommentsForPost(listing.id, 50).catch(() => []),
    getPostViewCount(listing.id),
  ]);
  const canEdit = Boolean(profile && (profile.id === listing.author || profile.is_editor));

  const profileMap = await getMembersByIds(fullThread.map((c) => c.author ?? 0)).catch(
    () => new Map<number, { slug: string; name: string; avatar: string; joinedAt: string }>()
  );

  const image = getFeaturedImage(listing);
  const { meta } = listing;
  const verified = meta.sc_claimed || meta.sc_verified;
  const matchedCategories = categories.filter((c) => listing.sc_listing_category?.includes(c.id));
  const socials = listingSocials(meta);
  const gallery = listing.sc_gallery_images ?? [];
  const listingTitle = stripHtml(listing.title.rendered);
  const sliderImages = [
    ...(image ? [{ url: image.source_url, alt: image.alt_text || listingTitle }] : []),
    ...gallery.map((photo) => ({ url: photo.url, alt: photo.alt || listingTitle })),
  ];
  const addressParts = [
    meta.sc_address_street,
    meta.sc_address_town,
    meta.sc_address_region,
    meta.sc_address_postcode,
  ].filter(Boolean);
  const mapQuery = addressParts.join(", ");
  const mapSrc =
    meta.sc_lat && meta.sc_lng
      ? `https://www.google.com/maps?q=${meta.sc_lat},${meta.sc_lng}&z=15&output=embed`
      : `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`;

  const ratings = fullThread.map((c) => c.rating).filter((r): r is number => typeof r === "number");
  const averageRating = ratings.length ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null;

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
    aggregateRating: averageRating
      ? {
          "@type": "AggregateRating",
          ratingValue: averageRating.toFixed(1),
          reviewCount: ratings.length,
        }
      : undefined,
  };

  return (
    <main className="container post-layout">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessSchema) }}
      />
      <PostViewTracker postId={listing.id} slug={listing.slug} title={stripHtml(listing.title.rendered)} />
      <div className="post-body directory-listing-card">
        <DirectoryImageSlider images={sliderImages} />
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
          {meta.sc_tagline && <p className="directory-tagline">{meta.sc_tagline}</p>}
          {(matchedCategories.length > 0 || meta.sc_featured) && (
            <div className="directory-badges">
              {matchedCategories.map((category) => (
                <Link key={category.id} href={`/directory?category=${category.slug}`} className="directory-category-pill">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />
                  </svg>
                  {category.name}
                </Link>
              ))}
              {meta.sc_featured && <span className="directory-badge">Featured</span>}
            </div>
          )}
          {!meta.sc_claimed && (
            <div className="directory-claim-row">
              <ClaimListingButton
                listingId={listing.id}
                isLoggedIn={Boolean(sessionToken)}
                initialPending={Boolean(listing.sc_claim_pending)}
              />
            </div>
          )}
          {fullThread.length > 0 && (
            <p className="event-meta-row">
              <CommentCountLink count={fullThread.length} kind="review" />
            </p>
          )}
          <div className="post-content" dangerouslySetInnerHTML={{ __html: listing.content.rendered }} />

          {socials.length > 0 && (
            <div className="directory-card-socials directory-detail-socials">
              {socials.map(({ key, url, Icon }) => (
                <a key={key} href={url} target="_blank" rel="noopener noreferrer" aria-label={key}>
                  <Icon />
                </a>
              ))}
            </div>
          )}

          <CommentSection
            postId={listing.id}
            comments={fullThread}
            isLoggedIn={Boolean(sessionToken)}
            commenterProfiles={profileMap}
            currentUserId={profile?.id}
            kind="review"
          />
        </div>
      </div>
      <aside className="post-sidebar">
        <div className="sidebar-block">
          <h2>Details</h2>
          {addressParts.length > 0 && <p>{addressParts.join(", ")}</p>}
          {meta.sc_phone && <p>{meta.sc_phone}</p>}
          {meta.sc_email && (
            <p>
              <a href={`mailto:${meta.sc_email}`}>{meta.sc_email}</a>
            </p>
          )}
          {meta.sc_website && (
            <p>
              <a href={meta.sc_website}>{meta.sc_website.replace(/^https?:\/\//, "")}</a>
            </p>
          )}
          <p className="directory-listing-stats">
            {viewCount} view{viewCount === 1 ? "" : "s"} · Listed since {formatListedSince(listing.date)}
          </p>
        </div>

        {(mapQuery || (meta.sc_lat && meta.sc_lng)) && (
          <div className="sidebar-block event-map">
            <iframe
              title="Listing location map"
              width="100%"
              height="220"
              style={{ border: 0 }}
              loading="lazy"
              src={mapSrc}
            />
          </div>
        )}
      </aside>
    </main>
  );
}
