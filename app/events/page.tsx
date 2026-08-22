import Link from "next/link";
import {
  getFeaturedImage,
  getLatestAddedScEvents,
  getScEventCategories,
  getScEvents,
  getUpcomingScEvents,
  parseEventDate,
} from "@/lib/wordpress";
import { EventCalendarMonth } from "./_components/EventCalendarMonth";
import { EventCategoryTiles } from "./_components/EventCategoryTiles";
import { EventCountdown } from "./_components/EventCountdown";

export const revalidate = 3600;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; category?: string; year?: string; month?: string }>;
}) {
  const { view, category, year, month } = await searchParams;
  const isCalendar = view === "calendar";
  const now = new Date();
  const calendarYear = Number(year) || now.getFullYear();
  const calendarMonth = Number(month) || now.getMonth() + 1;

  const [categories, upcoming, allEvents, latestAdded] = await Promise.all([
    getScEventCategories().catch(() => []),
    getUpcomingScEvents(100).catch(() => []),
    isCalendar ? getScEvents(300).catch(() => []) : Promise.resolve([]),
    getLatestAddedScEvents(5).catch(() => []),
  ]);

  const activeCategory = category ? categories.find((c) => c.slug === category) : null;
  const listEvents = activeCategory
    ? upcoming.filter((e) => e.sc_event_category?.includes(activeCategory.id))
    : upcoming;
  const calendarEvents = activeCategory
    ? allEvents.filter((e) => e.sc_event_category?.includes(activeCategory.id))
    : allEvents;

  const next = upcoming[0];
  const nextStart = next ? parseEventDate(next.meta.sc_start) : null;

  return (
    <main className="container">
      <div className="page-header-row">
        <h1>What&apos;s On</h1>
        <Link href="/events/submit" className="button-pill">
          Submit an event
        </Link>
      </div>

      {next && nextStart && (
        <EventCountdown
          title={next.title.rendered}
          slug={next.slug}
          startIso={nextStart.toISOString()}
          venueName={next.meta.sc_venue_name}
        />
      )}

      <EventCategoryTiles categories={categories} activeSlug={activeCategory?.slug} />

      <div className="event-view-switch">
        <Link
          href={activeCategory ? `/events?category=${activeCategory.slug}` : "/events"}
          className={!isCalendar ? "active" : undefined}
        >
          List
        </Link>
        <Link
          href={`/events?view=calendar${activeCategory ? `&category=${activeCategory.slug}` : ""}`}
          className={isCalendar ? "active" : undefined}
        >
          Calendar
        </Link>
      </div>

      {isCalendar ? (
        <EventCalendarMonth year={calendarYear} month={calendarMonth} events={calendarEvents} />
      ) : (
        <ul className="post-list">
          {listEvents.map((event) => {
            const image = getFeaturedImage(event);
            const startDate = parseEventDate(event.meta.sc_start);
            return (
              <li key={event.id}>
                <Link href={`/events/${event.slug}`}>
                  {image && <img src={image.source_url} alt={image.alt_text} loading="lazy" />}
                  <span className="card-title" dangerouslySetInnerHTML={{ __html: event.title.rendered }} />
                </Link>
                {startDate && (
                  <time dateTime={startDate.toISOString()}>
                    {startDate.toLocaleString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {event.meta.sc_venue_name ? ` — ${event.meta.sc_venue_name}` : ""}
                  </time>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {latestAdded.length > 0 && (
        <section className="home-section event-latest-added">
          <h2>Latest events added</h2>
          <ul className="event-row-list">
            {latestAdded.map((event) => {
              const image = getFeaturedImage(event);
              const startDate = parseEventDate(event.meta.sc_start);
              return (
                <li key={event.id}>
                  <Link href={`/events/${event.slug}`}>
                    {image && <img src={image.source_url} alt={image.alt_text} loading="lazy" />}
                    <div>
                      <span dangerouslySetInnerHTML={{ __html: event.title.rendered }} />
                      {startDate && (
                        <time dateTime={startDate.toISOString()}>
                          {startDate.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                        </time>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
