import type { WPCategory, WPContentItem, WPTag } from "@/lib/wordpress";
import { PostListCard } from "./PostListCard";

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
      {items.map((item) => (
        <PostListCard key={item.id} item={item} categoriesById={categoriesById} tagsById={tagsById} />
      ))}
    </ul>
  );
}
