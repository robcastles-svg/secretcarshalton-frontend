import Link from "next/link";
import { getFeaturedImage, stripHtml, type WPDirectoryCategory, type WPListing } from "@/lib/wordpress";

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.25-1.5 1.55-1.5H16.7V3.7C16.4 3.66 15.4 3.5 14.2 3.5c-2.4 0-4 1.46-4 4.15V10H7.5v3.1h2.7V21h3.3Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 4l16 16M20 4 4 20" />
    </svg>
  );
}

/** The <li> card used both on /directory itself and the homepage's directory section — same markup, one place to keep them in sync. */
export function DirectoryListingCard({
  listing,
  category,
}: {
  listing: WPListing;
  /** Only passed on /directory's category pages — the homepage's 3-latest grid doesn't show it. */
  category?: WPDirectoryCategory;
}) {
  const image = getFeaturedImage(listing);
  const verified = listing.meta.sc_claimed || listing.meta.sc_verified;
  const socials = [
    { key: "facebook", url: listing.meta.sc_facebook, Icon: FacebookIcon },
    { key: "instagram", url: listing.meta.sc_instagram, Icon: InstagramIcon },
    { key: "twitter", url: listing.meta.sc_twitter, Icon: TwitterIcon },
  ].filter((s) => s.url);

  return (
    <li>
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
      {category && <span className="card-category">{category.name}</span>}
      <p>{stripHtml(listing.content.rendered).slice(0, 120)}</p>
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
