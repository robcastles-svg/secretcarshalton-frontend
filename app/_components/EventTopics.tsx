import Link from "next/link";
import type { WPScEventTag } from "@/lib/wordpress";

/**
 * "Other" is the EventON migration's catch-all bucket, not a genuine
 * subject a visitor would want to browse by — left out of the topic
 * pills wherever they're shown, per Rob.
 */
export function eventTopicsFor(tags: WPScEventTag[], eventTagIds?: number[]): WPScEventTag[] {
  return tags.filter((t) => t.slug !== "other" && eventTagIds?.includes(t.id));
}

/**
 * Topic pills, each linking to that topic's filtered /events list. Kept
 * as a sibling of the card's own <Link> (never nested inside it) —
 * anchors can't nest, and every event card variant wraps its image/title
 * in one already.
 */
export function EventTopics({ topics, className }: { topics: WPScEventTag[]; className: string }) {
  if (topics.length === 0) return null;
  return (
    <div className={className}>
      {topics.map((topic) => (
        <Link key={topic.id} href={`/events?tag=${topic.slug}`} className="card-category">
          {topic.name}
        </Link>
      ))}
    </div>
  );
}
