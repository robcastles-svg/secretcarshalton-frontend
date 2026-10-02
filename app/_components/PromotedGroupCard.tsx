import Link from "next/link";
import { FeaturedListingImpressionTracker } from "./FeaturedListingImpressionTracker";
import { getFeaturedImage, stripHtml, type WPListing } from "@/lib/wordpress";

/**
 * Mirrors AdCard's exact markup (image-left on mobile, full-width-top on
 * desktop — see .ad-card-external in globals.css) but pink instead of
 * blue and "Featured" instead of "Advertisement" — a promoted group
 * listing, not a paid sc_ad. Links straight to the listing like any other
 * featured directory card, not through the ad click-tracking redirect,
 * and uses the same featured-listing impression tracker the pink grid
 * cards elsewhere already use.
 */
export function PromotedGroupCard({ listing }: { listing: WPListing }) {
  const image = getFeaturedImage(listing);
  const excerpt = listing.meta.sc_tagline || stripHtml(listing.content.rendered).slice(0, 120);

  return (
    <li className="ad-card-external ad-card-featured-group">
      <Link href={`/directory/${listing.slug}`} className="ad-card-row">
        {image && <img src={image.source_url} alt={image.alt_text} loading="lazy" />}
        <div className="card-text">
          <span className="ad-card-badge">Featured</span>
          <span className="card-title" dangerouslySetInnerHTML={{ __html: listing.title.rendered }} />
          {excerpt && <p className="ad-card-body">{excerpt}</p>}
        </div>
      </Link>
      <FeaturedListingImpressionTracker listingId={listing.id} />
    </li>
  );
}

/** The card plus its "View more groups" link — used both at the mobile-top position and in the desktop sidebar, see app/community/page.tsx. */
export function PromotedGroupSlot({ listing }: { listing: WPListing }) {
  return (
    <>
      <ul className="post-list">
        <PromotedGroupCard listing={listing} />
      </ul>
      <Link href="/community/groups" className="promoted-group-more-link">
        View more groups →
      </Link>
    </>
  );
}
