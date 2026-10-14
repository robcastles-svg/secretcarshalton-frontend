import Link from "next/link";
import { ReactionBar } from "@/app/_components/ReactionBar";
import { categoryHref, getFeaturedImage, stripHtml, type WPCategory, type WPContentItem, type WPTag } from "@/lib/wordpress";

/** The single card <li> — split out of ContentList so pages that need to interleave post cards with other card types (e.g. Discover's featured-listing cards) in one <ul> can render it directly. */
export function PostListCard({
  item,
  categoriesById,
  tagsById,
  showDate = true,
}: {
  item: WPContentItem;
  categoriesById?: Map<number, WPCategory>;
  tagsById?: Map<number, WPTag>;
  /** Discover's content is evergreen (mixed areas/eras, not a news timeline) — its cards skip the publish date. */
  showDate?: boolean;
}) {
  const image = getFeaturedImage(item);
  const tag = tagsById && item.tags?.map((id) => tagsById.get(id)).find(Boolean);
  const category = categoriesById && item.categories?.map((id) => categoriesById.get(id)).find(Boolean);
  const commentCount = item.comment_count ?? 0;
  return (
    <li>
      {/* Theme and place are their own separately-clickable links, siblings
          of the card's own links rather than nested inside them — anchors
          can't nest (same reason event-card-topics' pills sit outside
          their card's Link). Image and title are two separate Links (both
          to the post) rather than one wrapping both, so theme can still
          sit between them — above the headline, below the image — same
          position it always had. */}
      {image && (
        <Link href={`/${item.slug}`}>
          <img src={image.source_url} alt={image.alt_text} loading="lazy" />
        </Link>
      )}
      {tag && (
        <Link href={`/themes/${tag.slug}`} className="card-tag">
          {tag.name}
        </Link>
      )}
      <Link href={`/${item.slug}`} className="card-title" dangerouslySetInnerHTML={{ __html: item.title.rendered }} />
      {category && categoriesById && (
        <Link href={categoryHref(category, categoriesById)} className="card-category">
          {category.name}
        </Link>
      )}
      <div className="card-meta-row">
        {showDate && (
          <time dateTime={item.date}>
            {new Date(item.date).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
        )}
        <div className="card-actions">
          <ReactionBar
            slug={item.slug}
            title={stripHtml(item.title.rendered)}
            commentCount={commentCount}
            bookmarkId={item.id}
          />
        </div>
      </div>
      <div dangerouslySetInnerHTML={{ __html: item.excerpt.rendered }} />
    </li>
  );
}
