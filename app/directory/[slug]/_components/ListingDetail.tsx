import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { CommentCountLink } from "@/app/_components/CommentCountLink";
import { CommentSection } from "@/app/_components/CommentSection";
import { StarRatingDisplay } from "@/app/_components/StarRatingDisplay";
import { DirectoryImageSlider } from "@/app/_components/DirectoryImageSlider";
import { PostViewTracker } from "@/app/_components/PostViewTracker";
import { listingSocials } from "@/app/_components/SocialIcons";
import { StyledMap } from "@/app/_components/StyledMap";
import { ClaimListingButton } from "./ClaimListingButton";
import { DetailIcon } from "./DetailIcon";
import { SpotlightArticles } from "./SpotlightArticles";
import { getSessionToken } from "@/lib/auth";
import {
  getSpotlightArticles,
  getCommentsForPost,
  getDirectoryListingBySlug,
  getFeaturedImage,
  getMemberMe,
  getMembersByIds,
  getPostViewCount,
  GROUPS_CATEGORY_SLUG,
  stripHtml,
  soft,
  type WPDirectoryCategory,
  type WPListing,
} from "@/lib/wordpress";

function formatListedSince(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/**
 * Community groups are directory listings underneath (the "groups-to-join"
 * category) but live in the Community section (Rob, 2026-10): their page
 * is /community/groups/{slug}, and the old /directory/{slug} address
 * redirects there. Everything else stays under /directory.
 */
export function isGroupListing(listing: Pick<WPListing, "sc_listing_category">, categories: WPDirectoryCategory[]) {
  const groups = categories.find((c) => c.slug === GROUPS_CATEGORY_SLUG);
  return Boolean(groups && listing.sc_listing_category?.includes(groups.id));
}

export function listingPath(slug: string, isGroup: boolean) {
  return isGroup ? `/community/groups/${slug}` : `/directory/${slug}`;
}

/** Title, description and sharing image for a listing page, under whichever section it lives in. */
export async function listingMetadata(slug: string, path: string): Promise<Metadata> {
  const listing = await getDirectoryListingBySlug(slug).catch(soft(null));
  if (!listing) return {};

  const title = `${stripHtml(listing.title.rendered)} — Directory — Secret Carshalton`;
  // Standard listings share headline-only, same as their page (see isFeatured below).
  const isFeatured = Boolean(listing.meta.sc_featured);
  const description = isFeatured
    ? listing.meta.sc_tagline || stripHtml(listing.content.rendered).slice(0, 160) || undefined
    : undefined;
  const image = isFeatured ? (getFeaturedImage(listing) ?? listing.sc_gallery_images?.[0]) : undefined;
  const socialImage = image ? ("source_url" in image ? image.source_url : image.url) : undefined;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      images: socialImage ? [socialImage] : undefined,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: socialImage ? [socialImage] : undefined,
    },
  };
}

/**
 * A directory listing's own page — shared by /directory/{slug} (businesses)
 * and /community/groups/{slug} (community groups).
 */
export async function ListingDetail({
  slug,
  categories,
  section,
}: {
  slug: string;
  categories: WPDirectoryCategory[];
  section: "directory" | "community";
}) {
  const [listing, sessionToken] = await Promise.all([
    getDirectoryListingBySlug(slug).catch(soft(null)),
    getSessionToken(),
  ]);

  if (!listing) notFound();

  // Groups belong in Community, businesses in the Directory — each only at its own address.
  const isGroup = isGroupListing(listing, categories);
  if (isGroup !== (section === "community")) permanentRedirect(listingPath(listing.slug, isGroup));

  const [profile, fullThread, viewCount] = await Promise.all([
    sessionToken ? getMemberMe(sessionToken) : Promise.resolve(null),
    getCommentsForPost(listing.id, 50).catch(soft([])),
    getPostViewCount(listing.id),
  ]);
  const canEdit = Boolean(profile && (profile.id === listing.author || profile.is_editor));

  const [profileMap] = await Promise.all([
    getMembersByIds(fullThread.map((c) => c.author ?? 0)).catch(
      () => new Map<number, { slug: string; name: string; avatar: string; joinedAt: string; tier?: string }>()
    ),
  ]);

  const image = getFeaturedImage(listing);
  const { meta } = listing;
  const verified = meta.sc_claimed || meta.sc_verified;
  // Standard (any non-Featured listing) shows headline, address, website
  // and category only. Photos, description, tagline, socials, phone,
  // email and the map are Featured extras — still saved on the listing
  // (a lapsed or older listing keeps them), just not shown, so turning
  // Featured back on restores them without re-entering anything.
  const isFeatured = Boolean(meta.sc_featured);
  const matchedCategories = categories.filter((c) => listing.sc_listing_category?.includes(c.id));
  const socials = listingSocials(meta);
  const gallery = listing.sc_gallery_images ?? [];
  const listingTitle = stripHtml(listing.title.rendered);
  // The gallery (up to 3 photos) is the slider; its first photo is also
  // the cover/featured image, so the featured image is only used on its
  // own for older listings that never had a gallery.
  const sliderImages =
    gallery.length > 0
      ? gallery.map((photo) => ({ url: photo.url, alt: photo.alt || listingTitle }))
      : image
        ? [{ url: image.source_url, alt: image.alt_text || listingTitle }]
        : [];
  const addressParts = [
    meta.sc_address_street,
    meta.sc_address_town,
    meta.sc_address_region,
    meta.sc_address_postcode,
  ].filter(Boolean);
  const mapQuery = addressParts.join(", ");
  const mapLat = meta.sc_lat ? Number(meta.sc_lat) : undefined;
  const mapLng = meta.sc_lng ? Number(meta.sc_lng) : undefined;

  const spotlightArticles = isGroup
    ? []
    : await getSpotlightArticles((meta.sc_spotlight_slugs ?? "").split(",").map((x) => x.trim()).filter(Boolean));

  const ratings = fullThread.map((c) => c.rating).filter((r): r is number => typeof r === "number");
  const averageRating = ratings.length ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null;

  const businessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: listing.title.rendered,
    image: isFeatured && image ? image.source_url : undefined,
    url: meta.sc_website || undefined,
    telephone: (isFeatured && meta.sc_phone) || undefined,
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
      <div className="post-body">
        <Link href={section === "community" ? "/community/groups" : "/directory"} className="listing-back">
          <span aria-hidden="true">&larr;</span> {section === "community" ? "Back to groups" : "Back to directory"}
        </Link>
        <div className="directory-listing-card">
        {isFeatured && <DirectoryImageSlider images={sliderImages} />}
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
          {averageRating !== null && (
            <a href="#comments" className="directory-rating-summary">
              <StarRatingDisplay rating={averageRating} className="directory-rating-stars" />
              <b>{averageRating.toFixed(1)}</b>
              <span className="directory-rating-count">
                ({ratings.length} review{ratings.length === 1 ? "" : "s"})
              </span>
            </a>
          )}
          {isFeatured && meta.sc_tagline && <p className="directory-tagline">{meta.sc_tagline}</p>}
          {(matchedCategories.length > 0 || meta.sc_featured) && (
            <div className="directory-badges">
              {matchedCategories.map((category) => (
                <Link
                  key={category.id}
                  href={category.slug === GROUPS_CATEGORY_SLUG ? "/community/groups" : `/directory/${category.slug}`}
                  className="directory-category-pill"
                >
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
          {isFeatured && (
            <div className="post-content" dangerouslySetInnerHTML={{ __html: listing.content.rendered }} />
          )}

          {isFeatured && socials.length > 0 && (
            <div className="directory-card-socials directory-detail-socials">
              {socials.map(({ key, url, Icon }) => (
                <a key={key} href={url} target="_blank" rel="noopener noreferrer" aria-label={key}>
                  <Icon />
                </a>
              ))}
            </div>
          )}

          {/* Spotlight articles are for businesses, not community groups. */}
          {!isGroup && (
            <SpotlightArticles
              articles={spotlightArticles}
              editHref={profile?.is_editor ? `/directory/${listing.slug}/edit#spotlight` : undefined}
            />
          )}

          <CommentSection
            postId={listing.id}
            comments={fullThread}
            isLoggedIn={Boolean(sessionToken)}
            commenterProfiles={profileMap}
            currentUserId={profile?.id}
            showVotes={false}
            kind="review"
            canReply={canEdit}
          />
        </div>
        </div>
      </div>
      <aside className="post-sidebar">
        <div className="sidebar-block">
          <h2>Details</h2>
          {addressParts.length > 0 && (
            <p className="listing-detail">
              <DetailIcon name="address" />
              <span>{addressParts.join(", ")}</span>
            </p>
          )}
          {isFeatured && meta.sc_phone && (
            <p className="listing-detail">
              <DetailIcon name="phone" />
              <a href={`tel:${meta.sc_phone.replace(/[^\d+]/g, "")}`}>{meta.sc_phone}</a>
            </p>
          )}
          {isFeatured && meta.sc_email && (
            <p className="listing-detail">
              <DetailIcon name="email" />
              <a href={`mailto:${meta.sc_email}`}>{meta.sc_email}</a>
            </p>
          )}
          {meta.sc_website && (
            <p className="listing-detail">
              <DetailIcon name="website" />
              <a href={meta.sc_website}>{meta.sc_website.replace(/^https?:\/\//, "")}</a>
            </p>
          )}
          <p className="directory-listing-stats">
            {viewCount} view{viewCount === 1 ? "" : "s"} · Listed since {formatListedSince(listing.date)}
          </p>
        </div>

        {isFeatured && (mapQuery || (meta.sc_lat && meta.sc_lng)) && (
          <div className="sidebar-block event-map">
            <StyledMap query={mapQuery} lat={mapLat} lng={mapLng} />
          </div>
        )}
      </aside>
    </main>
  );
}
