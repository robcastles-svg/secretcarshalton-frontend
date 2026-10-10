import { getScEventCategories } from "@/lib/wordpress";
import { EventCategoryTiles } from "./EventCategoryTiles";

/** The existing area links bar, unchanged, shown above every events list page. */
export async function EventsAreaBar({ activeSlug }: { activeSlug?: string }) {
  const categories = await getScEventCategories().catch(() => []);
  return (
    <div className="events-dark evl-areabar">
      <nav className="container secondary-nav">
        <EventCategoryTiles categories={categories} activeSlug={activeSlug} />
      </nav>
    </div>
  );
}
