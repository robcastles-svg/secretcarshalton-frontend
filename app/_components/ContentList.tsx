import Link from "next/link";
import { getFeaturedImage, type WPContentItem } from "@/lib/wordpress";

export function ContentList({ items }: { items: WPContentItem[] }) {
  return (
    <ul className="post-list">
      {items.map((item) => {
        const image = getFeaturedImage(item);
        return (
          <li key={item.id}>
            <Link href={`/${item.slug}`}>
              {image && <img src={image.source_url} alt={image.alt_text} />}
              <span dangerouslySetInnerHTML={{ __html: item.title.rendered }} />
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
