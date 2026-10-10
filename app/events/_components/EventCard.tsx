import Link from "next/link";
import { getFeaturedImage, stripHtml, type WPScEvent } from "@/lib/wordpress";
import {
  formatTimeRange,
  getOccurrences,
  repeatFlag,
  venueShort,
  type Occurrence,
} from "@/lib/event-view";
import { DateTile } from "./DateTile";
import { ClockIcon, PinIcon, RepeatIcon } from "./EvIcons";

/**
 * An event card as the redesign mockup draws it: image on top (zooms and
 * darkens slightly on hover), then the date tile beside the headline, then
 * one grey line with time and venue. Deliberately no price and no
 * category. Repeating events get a "Monthly"/"Weekly" flag on the image
 * and "+N more dates". Featured events get a pink outline and badge.
 *
 * `occurrence` is the date this card stands for — the next date in the
 * main list, or a specific date on a month page (Stage 3).
 * `tone="light"` is the white card used on the organiser page;
 * `tone="dark"` the charcoal card for the black list pages.
 */
export function EventCard({
  event,
  occurrence,
  tone = "light",
}: {
  event: WPScEvent;
  occurrence: Occurrence;
  tone?: "light" | "dark";
}) {
  const image = getFeaturedImage(event);
  const title = stripHtml(event.title.rendered);
  const time = formatTimeRange(occurrence);
  const venue = venueShort(event);
  const flag = repeatFlag(event);
  const later = flag
    ? getOccurrences(event).filter((o) => o.start.getTime() > occurrence.start.getTime()).length
    : 0;
  const featured = Boolean(event.meta.sc_event_featured);

  return (
    <Link
      href={`/events/${event.slug}`}
      className={`evx-card evx-card-${tone}${featured ? " evx-card-featured" : ""}`}
    >
      <div className="evx-card-img">
        {image ? (
          <img src={image.source_url} alt="" loading="lazy" />
        ) : (
          <div className="evx-card-noimg" aria-hidden="true" />
        )}
        {featured && <span className="evx-badge-featured">Featured</span>}
        {flag && (
          <span className="evx-badge-repeat">
            <RepeatIcon />
            {flag}
          </span>
        )}
      </div>
      <div className="evx-card-body">
        <DateTile date={occurrence.start} size="sm" />
        <div className="evx-card-txt">
          <h3>{title}</h3>
          {(time || venue) && (
            <div className="evx-card-meta">
              {time && (
                <span>
                  <ClockIcon />
                  {time}
                </span>
              )}
              {venue && (
                <span>
                  <PinIcon />
                  {venue}
                </span>
              )}
            </div>
          )}
          {flag && <div className="evx-card-next">{later > 0 ? `+${later} more date${later > 1 ? "s" : ""}` : "Last date"}</div>}
        </div>
      </div>
    </Link>
  );
}
