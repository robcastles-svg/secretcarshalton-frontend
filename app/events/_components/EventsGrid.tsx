"use client";

import Link from "next/link";
import { useState } from "react";
import { EventImage } from "@/app/_components/EventImage";
import { getFeaturedImage, parseEventDate, stripHtml, type WPScEvent } from "@/lib/wordpress";

const PAGE_SIZE = 9;

/** The /events list view (browsable by category/tag) — capped at PAGE_SIZE with a "Load more" button rather than dumping every upcoming event on the page at once. Client-side reveal: the full filtered list is already fetched server-side, this just controls how much of it is shown. */
export function EventsGrid({ events }: { events: WPScEvent[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visible = events.slice(0, visibleCount);

  return (
    <>
      <ul className="post-list post-list-two-column">
        {visible.map((event) => {
          const image = getFeaturedImage(event);
          const startDate = parseEventDate(event.meta.sc_start);
          return (
            <li key={event.id}>
              {/* Image is a sibling of the Link, not nested inside it —
                  it's its own click-to-enlarge button (see EventImage's
                  expandable prop), and a <button> can't nest inside an
                  <a>. The Link still covers the heading (date badge +
                  title), so the card overall still has one obvious click
                  target through to the event; the photo is the one part
                  that does something else when clicked. */}
              <EventImage image={image} alt={stripHtml(event.title.rendered)} expandable />
              <Link href={`/events/${event.slug}`}>
                <div className="event-card-heading">
                  {startDate && (
                    <div className="event-card-date-badge">
                      <span className="event-card-date-badge-weekday">
                        {startDate.toLocaleString("en-GB", { weekday: "short" }).toUpperCase()}
                      </span>
                      <span className="event-card-date-badge-day">{startDate.getDate()}</span>
                      <span className="event-card-date-badge-month">
                        {startDate.toLocaleString("en-GB", { month: "short" }).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="card-title" dangerouslySetInnerHTML={{ __html: event.title.rendered }} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {visibleCount < events.length && (
        <div className="events-load-more">
          <button type="button" className="button-pill button-pill-secondary" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
            Load more events
          </button>
        </div>
      )}
    </>
  );
}
