import Link from "next/link";
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

  return (
    <li className={listing.meta.sc_featured ? "directory-card-featured" : undefined}>
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
    </li>
  );
}
