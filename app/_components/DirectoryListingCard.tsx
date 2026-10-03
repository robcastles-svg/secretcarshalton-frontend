import Link from "next/link";
import { BookmarkButton } from "@/app/_components/BookmarkButton";
import { listingSocials } from "@/app/_components/SocialIcons";
import { getFeaturedImage, stripHtml, type WPDirectoryCategory, type WPListing } from "@/lib/wordpress";

/** The <li> card used both on /directory itself and the homepage's directory section — same markup, one place to keep them in sync. */
export function DirectoryListingCard({
  listing,
  categoriesList,
}: {
  listing: WPListing;
  /** Only passed on /directory's category pages — the homepage's 3-latest grid doesn't show it. All matched categories, not just one — a listing can belong to more than one. */
  categoriesList?: WPDirectoryCategory[];
}) {
  const image = getFeaturedImage(listing);
  const verified = listing.meta.sc_claimed || listing.meta.sc_verified;
  const socials = listingSocials(listing.meta);
  const excerpt = listing.meta.sc_tagline || stripHtml(listing.content.rendered).slice(0, 120);
  const reviewCount = listing.sc_review_stats?.count ?? 0;

  return (
    <li className={listing.meta.sc_featured ? "directory-card-featured" : undefined}>
      {/*
       * Image and title as two separate links (both to the same listing),
       * not one wrapping both — matches PostListCard's own pattern (see
       * that component's docblock). This card gets interleaved into
       * .post-list grids built for PostListCard elsewhere (News's
       * featuredListing slot, Discover), whose desktop row-layout CSS
       * targets the image as "the <li>'s first child" and the title as
       * its own positioned grid item — a single wrapping link doesn't
       * let the two end up in different grid columns, which is how the
       * featured card's image+badge ended up visually broken on News.
       */}
      {image && (
        <Link href={`/directory/${listing.slug}`}>
          <img src={image.source_url} alt={image.alt_text} loading="lazy" />
        </Link>
      )}
      <Link href={`/directory/${listing.slug}`} className="card-title">
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
      </Link>
      {listing.meta.sc_featured && <span className="directory-badge">Featured</span>}
      {categoriesList?.map((category) => (
        <span key={category.id} className="card-category">
          {category.name}
        </span>
      ))}
      <p>{excerpt}</p>
      {socials.length > 0 && (
        <div className="directory-card-socials">
          {socials.map(({ key, url, Icon }) => (
            <a key={key} href={url} target="_blank" rel="noopener noreferrer" aria-label={key}>
              <Icon />
            </a>
          ))}
        </div>
      )}
      <div className="card-meta-row">
        <div className="card-actions">
          {reviewCount > 0 && (
            <Link
              href={`/directory/${listing.slug}#comments`}
              className="card-comment-count"
              aria-label={`${reviewCount} review${reviewCount === 1 ? "" : "s"} — jump to reviews`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1-5.2A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
              </svg>
              {reviewCount}
            </Link>
          )}
          <BookmarkButton contentType="listing" contentId={listing.id} />
        </div>
      </div>
    </li>
  );
}
