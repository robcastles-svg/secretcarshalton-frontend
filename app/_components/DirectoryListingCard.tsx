import Link from "next/link";
import { getFeaturedImage, stripHtml, type WPListing } from "@/lib/wordpress";

/** The <li> card used both on /directory itself and the homepage's directory section — same markup, one place to keep them in sync. */
export function DirectoryListingCard({ listing }: { listing: WPListing }) {
  const image = getFeaturedImage(listing);
  const verified = listing.meta.sc_claimed || listing.meta.sc_verified;

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
      <p>{stripHtml(listing.content.rendered).slice(0, 120)}</p>
    </li>
  );
}
