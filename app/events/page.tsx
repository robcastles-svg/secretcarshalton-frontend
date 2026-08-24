import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { EventImage } from "@/app/_components/EventImage";
import { eventTopicsFor, EventTopics } from "@/app/_components/EventTopics";
import {
  getFeaturedImage,
  getLatestAddedScEvents,
  getScEventCategories,
  getScEventTags,
  getScEvents,
  getUpcomingScEvents,
  parseEventDate,
  stripHtml,
} from "@/lib/wordpress";
import { EventCalendarMonth } from "./_components/EventCalendarMonth";
import { EventCategoryTiles } from "./_components/EventCategoryTiles";
import { EventCountdown } from "./_components/EventCountdown";
import { EventTagTiles } from "./_components/EventTagTiles";
import { EventsGrid } from "./_components/EventsGrid";

export const revalidate = 3600;

/** Builds the `?category=&tag=` query string shared by the list/calendar view-switch links. */
function filterQuery(categorySlug?: string, tagSlug?: string, hasLeadingParam = false): string {
  const params: string[] = [];
  if (categorySlug) params.push(`category=${categorySlug}`);
  if (tagSlug) params.push(`tag=${tagSlug}`);
  if (params.length === 0) return "";
  return (hasLeadingParam ? "&" : "?") + params.join("&");
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; category?: string; tag?: string; year?: string; month?: string }>;
}) {
  const { view, category, tag, year, month } = await searchParams;
  const isCalendar = view === "calendar";
  const now = new Date();
  const calendarYear = Number(year) || now.getFullYear();
  const calendarMonth = Number(month) || now.getMonth() + 1;

  const [categories, tags, upcoming, allEvents, latestAdded] = await Promise.all([
    getScEventCategories().catch(() => []),
    getScEventTags().catch(() => []),
    getUpcomingScEvents(100).catch(() => []),
    isCalendar ? getScEvents(300).catch(() => []) : Promise.resolve([]),
    getLatestAddedScEvents(5).catch(() => []),
  ]);

  const activeCategory = category ? categories.find((c) => c.slug === category) : null;
  const activeTag = tag ? tags.find((t) => t.slug === tag) : null;
  const matchesFilters = (e: { sc_event_category?: number[]; sc_event_tag?: number[] }) =>
    (!activeCategory || e.sc_event_category?.includes(activeCategory.id)) &&
    (!activeTag || e.sc_event_tag?.includes(activeTag.id));
  const listEvents = upcoming.filter(matchesFilters);
  const calendarEvents = allEvents.filter(matchesFilters);

  const next = upcoming[0];
  const nextStart = next ? parseEventDate(next.meta.sc_start) : null;

  return (
    <main className="container">
      <div className="page-header-row">
        <h1>
          What&apos;s On
          <CategoryKeyIcon />
        </h1>
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

      <EventCategoryTiles
        categories={categories}
        activeSlug={activeCategory?.slug}
        activeTagSlug={activeTag?.slug}
      />
      <EventTagTiles tags={tags} activeSlug={activeTag?.slug} activeCategorySlug={activeCategory?.slug} />

      <div className="event-view-switch">
        <Link
          href={`/events${filterQuery(activeCategory?.slug, activeTag?.slug)}`}
          className={!isCalendar ? "active" : undefined}
        >
          List
        </Link>
        <Link
          href={`/events?view=calendar${filterQuery(activeCategory?.slug, activeTag?.slug, true)}`}
          className={isCalendar ? "active" : undefined}
        >
          Calendar
        </Link>
      </div>

      {isCalendar ? (
        <EventCalendarMonth year={calendarYear} month={calendarMonth} events={calendarEvents} />
      ) : (
        <EventsGrid events={listEvents} tags={tags} />
      )}

      {latestAdded.length > 0 && (
        <section className="home-section event-latest-added">
          <h2>Latest events added</h2>
          <ul className="event-row-list">
            {latestAdded.map((event) => {
              const image = getFeaturedImage(event);
              const startDate = parseEventDate(event.meta.sc_start);
              const topics = eventTopicsFor(tags, event.sc_event_tag);
              return (
                <li key={event.id}>
                  <Link href={`/events/${event.slug}`}>
                    <EventImage image={image} alt={stripHtml(event.title.rendered)} />
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
                  <EventTopics topics={topics} className="event-row-topics" />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
