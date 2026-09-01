import type { WPAd, WPCategory, WPContentItem, WPTag } from "@/lib/wordpress";
import { withInterleavedAd } from "./AdCard";
import { PostListCard } from "./PostListCard";

/** One in-feed ad card mixed in per roughly-a-page-worth of cards — see AdCard's withInterleavedAd. */
const AD_EVERY = 6;

export function ContentList({
  items,
  categoriesById,
  tagsById,
  ad,
}: {
  items: WPContentItem[];
  /** When provided, each card shows its tag above the headline and category below it. */
  categoriesById?: Map<number, WPCategory>;
  tagsById?: Map<number, WPTag>;
  /** The active "in_feed" ad (if any) to mix into this grid — omit on lists too short/niche to carry ads (e.g. a post's own "Related stories"). */
  ad?: WPAd | null;
}) {
  const cards = items.map((item) => (
    <PostListCard key={item.id} item={item} categoriesById={categoriesById} tagsById={tagsById} />
  ));
  return <ul className="post-list">{withInterleavedAd(cards, ad ?? null, AD_EVERY)}</ul>;
}
