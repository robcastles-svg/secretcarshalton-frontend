import Link from "next/link";
import { getFeaturedImage, type WPCategory, type WPContentItem, type WPTag } from "@/lib/wordpress";

export function ContentList({
  items,
  categoriesById,
  tagsById,
}: {
  items: WPContentItem[];
  /** When provided, each card shows its tag above the headline and category below it. */
  categoriesById?: Map<number, WPCategory>;
  tagsById?: Map<number, WPTag>;
}) {
  return (
    <ul className="post-list">
      {items.map((item) => {
        const image = getFeaturedImage(item);
        const tag = tagsById && item.tags?.map((id) => tagsById.get(id)).find(Boolean);
        const category =
          categoriesById && item.categories?.map((id) => categoriesById.get(id)).find(Boolean);
        return (
          <li key={item.id}>
            <Link href={`/${item.slug}`}>
              {image && <img src={image.source_url} alt={image.alt_text} loading="lazy" />}
              <div className="card-text">
                {tag && <span className="card-tag">{tag.name}</span>}
                <span className="card-title" dangerouslySetInnerHTML={{ __html: item.title.rendered }} />
                {category && <span className="card-category">{category.name}</span>}
              </div>
            </Link>
            <time dateTime={item.date}>
              {new Date(item.date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
            <div dangerouslySetInnerHTML={{ __html: item.excerpt.rendered }} />
          </li>
        );
      })}
    </ul>
  );
}
