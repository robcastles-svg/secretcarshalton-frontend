import Link from "next/link";
import { EventImage } from "@/app/_components/EventImage";
import type { WPFeaturedMedia } from "@/lib/wordpress";

/** Calendar-day difference, not a raw ms/86400000 divide — "tomorrow" should mean the next calendar date, not merely ">12h away". */
function daysUntil(target: Date): number {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTarget = new Date(target);
  startOfTarget.setHours(0, 0, 0, 0);
  return Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000);
}

function countdownLabel(target: Date): string {
  const days = daysUntil(target);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function formatDayTime(date: Date): string {
  const weekday = date.toLocaleString("en-GB", { weekday: "long" });
  const time = date
    .toLocaleString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(" ", "")
    .toLowerCase();
  return `${weekday} ${time}`;
}

/**
 * The homepage Events section's featured card — same black card / pink
 * "Featured" lozenge / date box as the site's existing EventCountdown
 * (app/events/_components), reused for visual consistency, but with the
 * design handoff's own simpler "whole days until" countdown text (In X
 * days / Tomorrow / Today) instead of EventCountdown's live-ticking
 * hrs/min/sec timer — a deliberate difference from /events' own
 * countdown, not an oversight, per the handoff's "Countdown: whole days
 * until the featured event". No client JS needed since it doesn't tick.
 */
export function HomeFeaturedEvent({
  title,
  slug,
  startDate,
  venueName,
  image,
  imageAlt,
}: {
  title: string;
  slug: string;
  startDate: Date;
  venueName?: string;
  image: WPFeaturedMedia | null;
  imageAlt: string;
}) {
  return (
    <Link href={`/events/${slug}`} className="event-countdown home-featured-event">
      <div className="event-countdown-media">
        <EventImage image={image} alt={imageAlt} />
      </div>
      <div className="event-countdown-heading">
        <div className="event-countdown-date-badge">
          <span className="event-countdown-date-badge-weekday">
            {startDate.toLocaleString("en-GB", { weekday: "short" }).toUpperCase()}
          </span>
          <span className="event-countdown-date-badge-day">{startDate.getDate()}</span>
          <span className="event-countdown-date-badge-month">
            {startDate.toLocaleString("en-GB", { month: "short" }).toUpperCase()}
          </span>
        </div>
        <div className="event-countdown-body">
          <span className="event-countdown-featured-badge">Featured</span>
          <span className="event-countdown-title" dangerouslySetInnerHTML={{ __html: title }} />
          <span className="home-featured-event-daytime">{formatDayTime(startDate)}</span>
          {venueName && <span className="event-countdown-venue">{venueName}</span>}
        </div>
      </div>
      <div className="home-featured-event-countdown">{countdownLabel(startDate)}</div>
    </Link>
  );
}
