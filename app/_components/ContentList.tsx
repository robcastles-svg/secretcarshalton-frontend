import { Fragment } from "react";
import type { WPCategory, WPContentItem, WPListing, WPTag } from "@/lib/wordpress";
import { DirectoryListingCard } from "./DirectoryListingCard";
import { FeaturedListingImpressionTracker } from "./FeaturedListingImpressionTracker";
import { PostListCard } from "./PostListCard";

/** How far into the grid the featured listing card sits — early enough to be seen, not so early it reads as the top story. */
const FEATURED_LISTING_POSITION = 2;

export function ContentList({
  items,
  categoriesById,
  tagsById,
  featuredListing,
}: {
  items: WPContentItem[];
  /** When provided, each card shows its tag above the headline and category below it. */
  categoriesById?: Map<number, WPCategory>;
  tagsById?: Map<number, WPTag>;
  /** A directory listing's own paid-featured slot, interleaved into the grid — see getFeaturedListingForGrid. Pink, like .directory-card-featured everywhere else; blue self-serve ads never mix into this grid, only the sidebar — that visual territory is reserved for featured listings. */
  featuredListing?: WPListing | null;
}) {
  return (
    <ul className="post-list">
      {items.map((item, index) => (
        <Fragment key={item.id}>
          {featuredListing && index === FEATURED_LISTING_POSITION && (
            <>
              <DirectoryListingCard key={`featured-${featuredListing.id}`} listing={featuredListing} />
              <FeaturedListingImpressionTracker listingId={featuredListing.id} />
            </>
          )}
          <PostListCard item={item} categoriesById={categoriesById} tagsById={tagsById} />
        </Fragment>
      ))}
      {featuredListing && items.length <= FEATURED_LISTING_POSITION && (
        <>
          <DirectoryListingCard key={`featured-${featuredListing.id}`} listing={featuredListing} />
          <FeaturedListingImpressionTracker listingId={featuredListing.id} />
        </>
      )}
    </ul>
  );
}
